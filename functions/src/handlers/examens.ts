import type { QueryDocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';
import { auditer, auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue, Timestamp } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { FUSEAU_LOCAL, PRESENCES, resultatValide, ROLES_ADMIN, SESSIONS_EXAMEN, STATUTS_EXAMEN } from '../shared/domaine.js';

/** Date et heure de Nouakchott (horodatage des documents) ; pour une épreuve, utiliser horaireExamen. */
export const formaterDateHeure = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU_LOCAL, dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', ' à ');

/**
 * Inscriptions à convoquer : uniquement les inscriptions actives, une seule par étudiant
 * (la plus récente si un étudiant en a plusieurs la même année).
 */
export function inscriptionsConvocables(docs: QueryDocumentSnapshot[]): QueryDocumentSnapshot[] {
    const parEtudiant = new Map<string, QueryDocumentSnapshot>();
    docs.filter((d) => d.get('statut') === 'active')
        .sort((a, b) => (a.get('ordre') ?? 0) - (b.get('ordre') ?? 0))
        .forEach((d) => parEtudiant.set(d.get('etudiantId'), d));
    return [...parEtudiant.values()];
}

/** Exécute des écritures par lots de 400 (limite Firestore : 500 opérations par lot). */
export async function ecrireParLots<T>(elements: T[], ecrire: (lot: WriteBatch, element: T) => void): Promise<void> {
    for (let i = 0; i < elements.length; i += 400) {
        const lot = db.batch();
        elements.slice(i, i + 400).forEach((e) => ecrire(lot, e));
        await lot.commit();
    }
}

export const creerExamen = operation('creerExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            ueId: s.id(),
            anneeId: s.id(),
            session: s.choix(SESSIONS_EXAMEN),
            dateExamen: z.iso.datetime({ offset: true, error: 'date et heure invalides.' }),
            salle: s.texteOptionnel(100),
            noteSur: z.coerce.number().gt(0).max(100),
            seuilValidation: s.nombre(0, 100),
            statut: s.choix(STATUTS_EXAMEN),
        }),
        donnees,
    );
    if (v.seuilValidation > v.noteSur) erreurChamp('seuilValidation', 'Le seuil de validation ne peut pas dépasser la note maximale.');
    const [ue, annee] = await db.getAll(col.ues().doc(v.ueId), col.annees().doc(v.anneeId));
    if (!ue.exists) erreurChamp('ueId', 'UE inconnue.');
    if (!annee.exists) erreurChamp('anneeId', 'Année académique inconnue.');

    const eligibles = inscriptionsConvocables(
        (await col.inscriptions().where('anneeId', '==', v.anneeId).where('ueIds', 'array-contains', v.ueId).get()).docs,
    );
    const dateExamen = Timestamp.fromDate(new Date(v.dateExamen));
    const examensDeCetteUe = await col.examens().where('ueId', '==', v.ueId).get();
    const examenExistant = examensDeCetteUe.docs.find((document) =>
        document.get('anneeId') === v.anneeId
        && document.get('session') === v.session
        && (document.get('dateExamen') as Timestamp | undefined)?.toMillis() === dateExamen.toMillis(),
    );
    if (examenExistant) {
        const resultatsExistants = await col.resultats().where('examenId', '==', examenExistant.id).get();
        const inscriptionsDejaAjoutees = new Set(resultatsExistants.docs.map((document) => document.get('inscriptionId') as string));
        const etudiantsDejaConvoques = new Set(resultatsExistants.docs.map((document) => document.get('etudiantId') as string));
        const inscriptionsAajouter = eligibles.filter((inscription) =>
            !inscriptionsDejaAjoutees.has(inscription.id) && !etudiantsDejaConvoques.has(inscription.get('etudiantId')));
        if (inscriptionsAajouter.length && examenExistant.get('statut') !== 'Annulé') {
            const premierNumero = await db.runTransaction(async (tx) => {
                const compteur = col.compteurs().doc('convocations');
                const valeur = ((await tx.get(compteur)).get('valeur') as number | undefined) ?? 0;
                tx.set(compteur, { valeur: valeur + inscriptionsAajouter.length });
                return valeur + 1;
            });
            const existant = examenExistant.data();
            await ecrireParLots(inscriptionsAajouter, (lot, inscription) => {
                lot.set(col.resultats().doc(`${examenExistant.id}_${inscription.id}`), {
                    examenId: examenExistant.id, inscriptionId: inscription.id, etudiantId: inscription.get('etudiantId'),
                    ueId: existant.ueId, formationId: existant.formationId, anneeId: existant.anneeId,
                    session: existant.session, dateExamen: existant.dateExamen, salle: existant.salle,
                    noteSur: existant.noteSur, seuilValidation: existant.seuilValidation, statutExamen: existant.statut,
                    presence: 'Convoqué', note: null, commentaire: null, valide: false,
                    numeroConvocation: premierNumero + inscriptionsAajouter.indexOf(inscription),
                    ...trace(acteur, true),
                });
            });
            const apres = { nbConvoques: resultatsExistants.size + inscriptionsAajouter.length };
            const lotSuivi = db.batch();
            lotSuivi.update(examenExistant.ref, { ...apres, ...trace(acteur) });
            auditerModele(lotSuivi, acteur, 'Examen', examenExistant.id, 'updated', existant, apres);
            await lotSuivi.commit();
        }
        return {
            id: examenExistant.id,
            message: inscriptionsAajouter.length
                ? `Suivi INSEC déjà ouvert : ${inscriptionsAajouter.length} nouveau(x) candidat(s) ajouté(s).`
                : `Suivi INSEC déjà ouvert avec ${resultatsExistants.size} candidat(s).`,
        };
    }
    const ref = col.examens().doc();

    // Réserve une plage de numéros de convocation.
    const premier = await db.runTransaction(async (tx) => {
        const compteur = col.compteurs().doc('convocations');
        const valeur = ((await tx.get(compteur)).get('valeur') as number | undefined) ?? 0;
        tx.set(compteur, { valeur: valeur + eligibles.length });
        return valeur + 1;
    });

    const examen = {
        ueId: v.ueId, formationId: ue.get('formationId'), anneeId: v.anneeId, session: v.session, dateExamen,
        salle: v.salle, noteSur: v.noteSur, seuilValidation: v.seuilValidation, statut: v.statut, nbConvoques: eligibles.length,
    };
    const lotExamen = db.batch();
    lotExamen.set(ref, { ...examen, ...trace(acteur, true) });
    auditerModele(lotExamen, acteur, 'Examen', ref.id, 'created', null, examen);
    await lotExamen.commit();

    const convocations = eligibles.map((inscription, index) => ({ inscription, numero: premier + index }));
    await ecrireParLots(convocations, (lot, { inscription, numero }) => {
        lot.set(col.resultats().doc(`${ref.id}_${inscription.id}`), {
            examenId: ref.id, inscriptionId: inscription.id, etudiantId: inscription.get('etudiantId'),
            ueId: v.ueId, formationId: examen.formationId, anneeId: v.anneeId, session: v.session, dateExamen,
            salle: v.salle, noteSur: v.noteSur, seuilValidation: v.seuilValidation, statutExamen: v.statut,
            presence: 'Convoqué', note: null, commentaire: null, valide: false, numeroConvocation: numero,
            ...trace(acteur, true),
        });
    });
    const lotAudit = db.batch();
    auditer(lotAudit, acteur, {
        action: 'created', modele: 'Examen', modeleId: ref.id,
        description: 'Ouverture du suivi local de l’épreuve INTEC ' + ue.get('code') + ' pour ' + eligibles.length + ' étudiant(s). Aucun e-mail envoyé.',
        apres: { candidatsAjoutes: eligibles.length, convocationsEnvoyees: 0 },
    });
    await lotAudit.commit();
    return { id: ref.id, message: 'Suivi INSEC ouvert pour l’épreuve INTEC avec ' + eligibles.length + ' candidat(s). Aucun e-mail n’a été envoyé.' };
});

export const enregistrerResultat = operation('enregistrerResultat', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            presence: s.choix(PRESENCES),
            note: z.preprocess((x) => (x === '' || x === undefined ? null : x), z.coerce.number().min(0).nullable()),
            commentaire: s.texteOptionnel(1000),
        }),
        donnees,
    );
    await db.runTransaction(async (tx) => {
        const ref = col.resultats().doc(v.id);
        const avant = await exiger(tx, ref, 'Résultat introuvable.');
        if (v.presence === 'Présent' && v.note === null) erreurChamp('note', 'Une note est obligatoire pour un étudiant présent.');
        if (v.note !== null && v.note > avant.noteSur) erreurChamp('note', `La note ne peut pas dépasser ${avant.noteSur}.`);
        const note = v.presence === 'Présent' ? v.note : null;
        const apres = {
            presence: v.presence, note, commentaire: v.commentaire,
            valide: resultatValide({ presence: v.presence, note, seuilValidation: avant.seuilValidation }),
        };
        // Une note nouvelle ou corrigée redevient « à publier » ; un résultat sans champ resultatPublie
        // date d'avant la publication groupée et a déjà été envoyé.
        const change = note !== (avant.note ?? null) || v.presence !== avant.presence;
        tx.update(ref, { ...apres, ...(change ? { resultatPublie: false } : {}), ...trace(acteur) });
        auditerModele(tx, acteur, 'ResultatExamen', v.id, 'updated', avant, apres);
    });
    return { message: 'Résultat enregistré. Il sera envoyé à l’étudiant lors de la publication des résultats.' };
});

const emailValide = (email: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());

/** Envoie en une fois les notes nouvelles ou corrigées d'une épreuve ; chaque note n'est envoyée qu'une fois. */
export const publierResultatsExamen = operation('publierResultatsExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id() }), donnees);
    const examen = await exiger(null, col.examens().doc(v.id), 'Examen introuvable.');
    if (examen.statut === 'Annulé') refuser('Les résultats d’un examen annulé ne peuvent pas être publiés.');
    const ue = (await col.ues().doc(examen.ueId).get()).data() ?? {};
    const aPublier = (await col.resultats().where('examenId', '==', v.id).get()).docs
        .filter((d) => d.get('note') !== null && d.get('note') !== undefined && d.get('resultatPublie') === false);
    if (!aPublier.length) return { message: 'Aucun nouveau résultat à publier.', publies: 0, sansEmail: 0 };

    let publies = 0;
    let sansEmail = 0;
    // Par paquets, dans des transactions : deux publications simultanées n'envoient pas deux fois la même note.
    for (let i = 0; i < aPublier.length; i += 100) {
        const paquet = aPublier.slice(i, i + 100);
        const bilan = await db.runTransaction(async (tx) => {
            const resultats = await Promise.all(paquet.map((d) => tx.get(d.ref)));
            const encore = resultats.filter((d) => d.exists && d.get('note') !== null && d.get('resultatPublie') === false);
            const etudiants = encore.length ? await tx.getAll(...encore.map((d) => col.etudiants().doc(String(d.get('etudiantId'))))) : [];
            let envoyes = 0;
            let ignores = 0;
            encore.forEach((resultat, index) => {
                const etudiant = etudiants[index]?.data();
                tx.update(resultat.ref, { resultatPublie: true, resultatPublieLe: FieldValue.serverTimestamp(), ...trace(acteur) });
                if (!etudiant || !emailValide(etudiant.email)) {
                    ignores += 1;
                    return;
                }
                mettreEnFileEmail(tx, {
                    destinataire: String(etudiant.email).trim(), nomDestinataire: nomComplet(etudiant), type: 'Résultat',
                    sujet: 'Publication d’un résultat INSEC', titre: 'Votre résultat est disponible',
                    message: `Bonjour ${String(etudiant.prenom ?? '').trim() || nomComplet(etudiant)}, votre résultat pour l’UE ${ue.code ?? ''} est disponible.`,
                    details: {
                        UE: String(ue.code ?? ''),
                        Note: `${resultat.get('note')}/${resultat.get('noteSur')}`,
                        Décision: resultat.get('valide') ? 'Validée' : 'Non validée',
                    },
                    lien: null, libelleLien: null,
                });
                envoyes += 1;
            });
            return { envoyes, ignores };
        });
        publies += bilan.envoyes + bilan.ignores;
        sansEmail += bilan.ignores;
    }
    const lot = db.batch();
    auditer(lot, acteur, {
        action: 'updated', modele: 'Examen', modeleId: v.id,
        description: `Publication des résultats : ${publies} résultat(s), dont ${sansEmail} sans adresse e-mail.`,
        apres: { publies, sansEmail },
    });
    await lot.commit();
    return {
        message: `${publies} résultat(s) publié(s).` + (sansEmail ? ` ${sansEmail} étudiant(s) sans adresse e-mail valide n’ont pas reçu d’e-mail.` : ''),
        publies,
        sansEmail,
    };
});

/**
 * Modifie la date (heure de Paris), la salle ou le statut d'une épreuve, et recopie ces informations
 * sur les convocations. Si la date ou la salle change, les convocations déjà envoyées peuvent être renvoyées.
 */
export const modifierExamen = operation('modifierExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            dateExamen: z.iso.datetime({ offset: true, error: 'date et heure invalides.' }),
            salle: s.texteOptionnel(100),
            statut: s.choix(STATUTS_EXAMEN),
        }),
        donnees,
    );
    const ref = col.examens().doc(v.id);
    const avant = await exiger(null, ref, 'Examen introuvable.');
    const resultats = (await col.resultats().where('examenId', '==', v.id).get()).docs;
    if (v.statut === 'Annulé' && avant.statut !== 'Annulé' && resultats.some((d) => d.get('note') !== null && d.get('note') !== undefined)) {
        erreurChamp('statut', 'Des notes sont déjà saisies pour cet examen : il ne peut pas être annulé.');
    }
    const dateExamen = Timestamp.fromDate(new Date(v.dateExamen));
    const dateChangee = (avant.dateExamen as Timestamp | undefined)?.toMillis() !== dateExamen.toMillis();
    const salleChangee = (avant.salle ?? null) !== (v.salle ?? null);
    const apres = { dateExamen, salle: v.salle, statut: v.statut };
    const lot = db.batch();
    lot.update(ref, { ...apres, ...trace(acteur) });
    auditerModele(lot, acteur, 'Examen', v.id, 'updated', { dateExamen: avant.dateExamen, salle: avant.salle ?? null, statut: avant.statut }, apres);
    await lot.commit();

    // Convocations déjà envoyées avec l'ancienne date ou l'ancienne salle : elles redeviennent « à envoyer ».
    const aRenvoyer = (dateChangee || salleChangee) && v.statut !== 'Annulé'
        ? resultats.filter((d) => d.get('convocationEnvoiStatut') === 'Envoyée' && d.get('presence') === 'Convoqué')
        : [];
    const idsARenvoyer = new Set(aRenvoyer.map((d) => d.id));
    await ecrireParLots(resultats, (lotResultats, d) => {
        lotResultats.update(d.ref, {
            dateExamen, salle: v.salle, statutExamen: v.statut,
            ...(idsARenvoyer.has(d.id) ? { convocationEnvoiStatut: null, convocationModifieeLe: FieldValue.serverTimestamp() } : {}),
            ...trace(acteur),
        });
    });
    const message = v.statut === 'Annulé'
        ? 'Examen annulé. Aucune convocation ne sera plus envoyée.'
        : aRenvoyer.length
            ? `Examen modifié. ${aRenvoyer.length} convocation(s) déjà envoyée(s) avec l’ancienne date ou salle sont à renvoyer.`
            : 'Examen modifié.';
    return { message, aRenvoyer: aRenvoyer.length };
});


export const enregistrerPresencesExamen = operation('enregistrerPresencesExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            presences: z.array(z.object({ resultatId: s.id(), presence: s.choix(PRESENCES) })).min(1).max(400),
        }),
        donnees,
    );
    const ids = v.presences.map((p) => p.resultatId);
    if (new Set(ids).size !== ids.length) erreurChamp('presences', 'Un étudiant ne peut apparaître qu’une seule fois dans cette opération.');

    const examen = await exiger(null, col.examens().doc(v.id), 'Examen introuvable.');
    if (examen.statut === 'Annulé') erreurChamp('id', 'Les présences ne peuvent pas être modifiées pour un examen annulé.');

    const refs = v.presences.map((p) => col.resultats().doc(p.resultatId));
    const documents = await db.getAll(...refs);
    documents.forEach((doc, index) => {
        if (!doc.exists || doc.get('examenId') !== v.id) {
            erreurChamp('presences', 'Un résultat ne correspond pas à cette épreuve.');
        }
        if (v.presences[index].presence !== 'Présent' && doc.get('note') !== null && doc.get('note') !== undefined) {
            erreurChamp('presences', 'Une note existe déjà pour un résultat. Modifiez ce statut individuellement pour protéger la note.');
        }
    });

    const changements = v.presences
        .map((presence, index) => ({ presence, ref: refs[index], avant: documents[index].data()! }))
        .filter(({ presence, avant }) => presence.presence !== avant.presence);
    if (!changements.length) return { message: 'Aucune présence à mettre à jour.' };

    const lot = db.batch();
    changements.forEach(({ presence, ref, avant }) => {
        const note = presence.presence === 'Présent' ? (avant.note ?? null) : null;
        const apres = {
            presence: presence.presence,
            note,
            valide: resultatValide({ presence: presence.presence, note, seuilValidation: avant.seuilValidation }),
        };
        lot.update(ref, { ...apres, ...trace(acteur) });
    });
    auditer(lot, acteur, {
        action: 'updated',
        modele: 'Examen',
        modeleId: v.id,
        description: `Présences enregistrées pour ${changements.length} étudiant(s) à l’examen.`,
        avant: { resultats: changements.map(({ ref, avant }) => ({ id: ref.id, presence: avant.presence, note: avant.note ?? null })) },
        apres: {
            resultats: changements.map(({ presence, ref, avant }) => ({
                id: ref.id,
                presence: presence.presence,
                note: presence.presence === 'Présent' ? (avant.note ?? null) : null,
            })),
        },
    });
    await lot.commit();
    return { message: `Présences enregistrées pour ${changements.length} étudiant(s). Aucune note ni aucun e-mail n’a été envoyé.` };
});


const quantiteOptionnelle = z.preprocess(
    (valeur) => (valeur === '' || valeur === undefined || valeur === null ? null : valeur),
    z.coerce.number().int().min(0).max(500).nullable(),
);

export const mettreAJourPreparationExamen = operation('mettreAJourPreparationExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            sujetsRecusLe: s.dateOptionnelle(),
            nombreSujetsRecus: quantiteOptionnelle,
            salleConfirmee: z.boolean(),
            surveillanceConfirmee: z.boolean(),
            nombreCopiesRassemblees: quantiteOptionnelle,
            copiesEnvoyeesLe: s.dateOptionnelle(),
            referenceEnvoiCopies: s.texteOptionnel(120),
        }),
        donnees,
    );

    if (Boolean(v.sujetsRecusLe) !== (v.nombreSujetsRecus !== null)) {
        erreurChamp('sujetsRecusLe', 'Renseignez ensemble la date de réception et le nombre de lots de sujets reçus.');
    }

    const resultats = await col.resultats().where('examenId', '==', v.id).get();
    const presents = resultats.docs.filter((resultat) => resultat.get('presence') === 'Présent').length;
    if (v.nombreCopiesRassemblees !== null && v.nombreCopiesRassemblees > presents) {
        erreurChamp('nombreCopiesRassemblees', 'Le nombre de copies rassemblées dépasse les ' + presents + ' candidat(s) marqué(s) présent(s).');
    }
    if (v.copiesEnvoyeesLe && v.nombreCopiesRassemblees !== presents) {
        erreurChamp('copiesEnvoyeesLe', 'Avant d’indiquer l’envoi, renseignez les ' + presents + ' copie(s) correspondant aux candidats présents.');
    }

    await db.runTransaction(async (tx) => {
        const ref = col.examens().doc(v.id);
        const avant = await exiger(tx, ref, 'Examen introuvable.');
        const apres = {
            sujetsRecusLe: v.sujetsRecusLe,
            nombreSujetsRecus: v.nombreSujetsRecus,
            salleConfirmee: v.salleConfirmee,
            surveillanceConfirmee: v.surveillanceConfirmee,
            nombreCopiesRassemblees: v.nombreCopiesRassemblees,
            copiesEnvoyeesLe: v.copiesEnvoyeesLe,
            referenceEnvoiCopies: v.referenceEnvoiCopies,
        };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Examen', v.id, 'updated', avant, apres);
    });

    return { message: 'Suivi de préparation de l’examen enregistré.' };
});
