import { randomUUID } from 'node:crypto';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet, prochainNumero } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { formaterMontant, MODES_PAIEMENT, numeroFormate, ROLES_ADMIN, ROLES_FINANCE, STATUTS_VERSEMENT } from '../shared/domaine.js';

const formaterDate = (iso: string) => iso.split('-').reverse().join('/');

/** Enregistre la prise en charge BUMEX sans fabriquer de versement ou reçu étudiant. */
export const confirmerReglementBumex2024 = operation('confirmerReglementBumex2024', ROLES_ADMIN, async (_donnees, acteur) => {
    const refs = await col.inscriptions().where('anneeId', '==', '2024-2025').where('formationId', '==', 'DGC').get();
    if (refs.size !== 11 || refs.docs.reduce((n, d) => n + ((d.get('ueIds') as string[] | undefined)?.length ?? 0), 0) !== 41) {
        refuser('Vérification interrompue : l’année 2024-2025 ne contient pas exactement les 11 dossiers DGC et 41 UE attendus.');
    }
    await db.runTransaction(async (tx) => {
        for (const doc of refs.docs) {
            const inscription = doc.data();
            const montantBumex = ((inscription.ueIds as string[] | undefined)?.length ?? 0) * 16_000;
            const noteBumex = 'Prise en charge BUMEX intégralement réglée pour 2024-2025, selon confirmation de la direction. Aucune date, référence bancaire ou quittance individuelle fournie.';
            const noteFinanciere = String(inscription.noteFinanciere ?? '').includes(noteBumex) ? inscription.noteFinanciere : [inscription.noteFinanciere, noteBumex].filter(Boolean).join('\n');
            const avant = { financeur: inscription.financeur ?? null, montantDu: inscription.montantDu ?? null, montantRemise: inscription.montantRemise ?? null, montantBumex: inscription.montantBumex ?? null, statutBumex: inscription.statutBumex ?? null, noteFinanciere: inscription.noteFinanciere ?? null };
            const apres = { financeur: 'bumex', montantDu: montantBumex, montantRemise: 0, montantBumex, statutBumex: 'reglee', noteFinanciere };
            tx.update(doc.ref, { ...apres, ...trace(acteur) });
            auditerModele(tx, acteur, 'Inscription', doc.id, 'updated', avant, apres);
        }
    });
    return { message: 'Prise en charge BUMEX appliquée aux 11 inscriptions 2024-2025 (41 UE), sans créer de versements individuels.' };
});

export const modifierSituationFinanciere = operation('modifierSituationFinanciere', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({ id: s.id(), montantDu: s.entier(0), montantRemise: s.entier(0), noteFinanciere: s.texteOptionnel(2000) }),
        donnees,
    );
    if (v.montantRemise > v.montantDu) erreurChamp('montantRemise', 'La remise ne peut pas dépasser le montant dû.');
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.id);
        const avant = await exiger(tx, ref, 'Inscription introuvable.');
        const apres = { montantDu: v.montantDu, montantRemise: v.montantRemise, noteFinanciere: v.noteFinanciere };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', v.id, 'updated', avant, apres);
    });
    return { message: 'Situation financière mise à jour.' };
});

export const ajouterVersement = operation('ajouterVersement', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({
            inscriptionId: s.id(),
            montant: s.entier(1),
            dateVersement: s.date(),
            statut: s.choix(STATUTS_VERSEMENT),
            modePaiement: s.choix(MODES_PAIEMENT),
            reference: s.texteOptionnel(100),
            note: s.texteOptionnel(1000),
        }),
        donnees,
    );
    const ref = col.versements().doc();
    let numeroRecu = '';
    let confirmationMiseEnFile = false;
    await db.runTransaction(async (tx) => {
        const inscriptionRef = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, inscriptionRef, 'Inscription introuvable.');
        if (inscription.financeur === 'bumex') refuser('Cette inscription est prise en charge par BUMEX : aucun versement étudiant ne peut y être enregistré.');
        const etudiant = await exiger(tx, col.etudiants().doc(inscription.etudiantId), 'Étudiant introuvable.');
        const [numero, incrementer] = await prochainNumero(tx, 'recus');
        numeroRecu = numeroFormate('REC', numero, new Date());
        const versement = {
            inscriptionId: v.inscriptionId,
            etudiantId: inscription.etudiantId,
            montant: v.montant,
            dateVersement: v.dateVersement,
            statut: v.statut,
            modePaiement: v.modePaiement,
            reference: v.reference,
            note: v.note,
            numeroRecu,
        };
        incrementer();
        tx.set(ref, { ...versement, ...trace(acteur, true) });
        if (v.statut === 'Validée') {
            tx.update(inscriptionRef, { totalVerse: FieldValue.increment(v.montant), ...trace(acteur) });
            const email = String(etudiant.email ?? '').trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mettreEnFileEmail(tx, {
                    destinataire: email,
                    nomDestinataire: nomComplet(etudiant),
                    type: 'Paiement',
                    sujet: 'Confirmation de votre paiement INSEC',
                    titre: 'Paiement validé',
                    message: 'Votre versement a été validé et enregistré dans votre dossier financier.',
                    details: { Reçu: numeroRecu, Montant: `${formaterMontant(v.montant)} MRU`, Date: formaterDate(v.dateVersement) },
                });
                confirmationMiseEnFile = true;
            }
        }
        auditerModele(tx, acteur, 'Versement', ref.id, 'created', null, versement);
    });
    const message = v.statut !== 'Validée'
        ? 'Versement en attente enregistré avec un numéro de reçu.'
        : confirmationMiseEnFile
          ? 'Versement validé et enregistré. La confirmation de paiement a été mise en file d’envoi.'
          : 'Versement validé et enregistré. Aucune adresse e-mail valide : aucune notification n’a été mise en file d’envoi.';
    return { id: ref.id, numeroRecu, message };
});

export const ajouterEcheance = operation('ajouterEcheance', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({ inscriptionId: s.id(), libelle: s.texte(100), montant: s.entier(1), dateEcheance: s.date() }),
        donnees,
    );
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, ref, 'Inscription introuvable.');
        if (inscription.financeur === 'bumex') refuser('Cette inscription est prise en charge par BUMEX : aucun échéancier étudiant ne peut y être enregistré.');
        const echeance = { id: randomUUID(), libelle: v.libelle, montant: v.montant, dateEcheance: v.dateEcheance };
        const echeances = [...(inscription.echeances ?? []), echeance].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
        tx.update(ref, { echeances, ...trace(acteur) });
        auditerModele(tx, acteur, 'Echeance', echeance.id, 'created', null, { inscriptionId: v.inscriptionId, ...echeance });
    });
    return { message: 'Échéance ajoutée.' };
});


const tauxEuroMruRef = () => db.collection('parametres').doc('tauxEuroMru');

export const lireTauxEuroMru = operation('lireTauxEuroMru', ROLES_FINANCE, async () => {
    const document = await tauxEuroMruRef().get();
    if (!document.exists) return { taux: null, modifieLe: null };
    const modifieLe = document.get('modifieLe');
    return {
        taux: typeof document.get('taux') === 'number' ? document.get('taux') as number : null,
        modifieLe: modifieLe && typeof modifieLe.toDate === 'function' ? modifieLe.toDate().toISOString() : null,
    };
});

export const modifierTauxEuroMru = operation('modifierTauxEuroMru', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(z.object({ taux: s.nombre(1, 200) }), donnees);
    const ref = tauxEuroMruRef();
    await db.runTransaction(async (tx) => {
        const document = await tx.get(ref);
        const avant = document.exists ? { taux: document.get('taux'), source: document.get('source') } : null;
        const apres = { taux: v.taux, source: 'Saisie manuelle' };
        tx.set(ref, { ...apres, modifieLe: FieldValue.serverTimestamp(), modifiePar: acteur.uid }, { merge: true });
        auditerModele(tx, acteur, 'Paramètre financier', ref.id, document.exists ? 'updated' : 'created', avant, apres);
    });
    const document = await ref.get();
    const modifieLe = document.get('modifieLe');
    return {
        taux: v.taux,
        modifieLe: modifieLe && typeof modifieLe.toDate === 'function' ? modifieLe.toDate().toISOString() : new Date().toISOString(),
        message: 'Taux EUR/MRU enregistré et journalisé.',
    };
});
