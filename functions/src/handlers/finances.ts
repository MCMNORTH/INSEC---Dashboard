import { randomUUID } from 'node:crypto';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet, prochainNumero } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import {
    dateDuJour, decouperEcheancier, estRecouvrable, formaterMontant, MODES_PAIEMENT, montantNet, numeroFormate, ROLES_ADMIN, ROLES_FINANCE,
    soldeRestant, STATUT_VERSEMENT_ANNULE, STATUTS_VERSEMENT, type Echeance, type SituationFinanciere,
} from '../shared/domaine.js';

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

/**
 * Enregistre (ou annule) le règlement par BUMEX d'une inscription qu'il finance.
 * Aucun versement ni reçu étudiant n'est créé : le financement BUMEX est suivi à part.
 */
export const enregistrerReglementBumex = operation('enregistrerReglementBumex', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({
            inscriptionId: s.id(),
            regle: z.boolean(),
            montant: s.entier(1).optional(),
            dateReglement: s.dateOptionnelle(),
            reference: s.texteOptionnel(100),
            motif: s.texteOptionnel(500),
        }),
        donnees,
    );
    if (v.regle) {
        if (!v.montant) erreurChamp('montant', 'Indiquez le montant réglé par BUMEX.');
        if (!v.dateReglement) erreurChamp('dateReglement', 'Indiquez la date du règlement.');
        if (v.dateReglement > dateDuJour()) erreurChamp('dateReglement', 'La date du règlement ne peut pas être dans le futur.');
    } else if (!v.motif) {
        erreurChamp('motif', 'Un motif est obligatoire pour annuler un règlement BUMEX.');
    }
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, ref, 'Inscription introuvable.');
        if (inscription.financeur !== 'bumex') refuser('Cette inscription n’est pas prise en charge par BUMEX.');
        if (inscription.statut === 'annulée') refuser('Cette inscription est annulée.');
        if (!v.regle && inscription.statutBumex !== 'reglee') refuser('Aucun règlement BUMEX n’est enregistré sur cette inscription.');
        const avant = {
            statutBumex: inscription.statutBumex ?? 'a_regler', montantBumex: inscription.montantBumex ?? null,
            dateReglementBumex: inscription.dateReglementBumex ?? null, referenceBumex: inscription.referenceBumex ?? null,
        };
        const apres = v.regle
            ? { statutBumex: 'reglee', montantBumex: v.montant, dateReglementBumex: v.dateReglement, referenceBumex: v.reference, motifAnnulationBumex: null }
            : { statutBumex: 'a_regler', dateReglementBumex: null, referenceBumex: null, motifAnnulationBumex: v.motif };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', v.inscriptionId, 'updated', avant, apres);
    });
    return { message: v.regle ? 'Règlement BUMEX enregistré.' : 'Règlement BUMEX annulé : l’inscription est de nouveau à régler par BUMEX.' };
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

/** Valide ou rejette, une seule fois, un versement « En attente » ; le solde est mis à jour dans la même transaction. */
export const traiterVersement = operation('traiterVersement', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id(), statut: s.choix(['Validée', 'Rejetée'] as const), motif: s.texteOptionnel(500) }), donnees);
    if (v.statut === 'Rejetée' && !v.motif?.trim()) erreurChamp('motif', 'Un motif est obligatoire pour rejeter un versement.');
    let confirmationMiseEnFile = false;
    await db.runTransaction(async (tx) => {
        const versementRef = col.versements().doc(v.id);
        const versement = await exiger(tx, versementRef, 'Versement introuvable.');
        if (versement.statut !== 'En attente') refuser('Seul un versement en attente peut être validé ou rejeté.');
        const inscriptionRef = col.inscriptions().doc(versement.inscriptionId);
        const inscription = await exiger(tx, inscriptionRef, 'Inscription introuvable.');
        const etudiant = await exiger(tx, col.etudiants().doc(versement.etudiantId ?? inscription.etudiantId), 'Étudiant introuvable.');
        if (v.statut === 'Validée' && inscription.financeur === 'bumex') refuser('Cette inscription est prise en charge par BUMEX : le versement ne peut pas être validé.');
        const situation = inscription as unknown as SituationFinanciere;
        const soldeApresPaiement = v.statut === 'Validée' ? Math.max(soldeRestant(situation) - versement.montant, 0) : null;
        const avant = { statut: versement.statut };
        const apres = { statut: v.statut, motifRejet: v.statut === 'Rejetée' ? v.motif!.trim() : null };
        tx.update(versementRef, { ...apres, ...trace(acteur) });
        if (v.statut === 'Validée') {
            tx.update(inscriptionRef, { totalVerse: FieldValue.increment(versement.montant), ...trace(acteur) });
            const email = String(etudiant.email ?? '').trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mettreEnFileEmail(tx, {
                    destinataire: email,
                    nomDestinataire: nomComplet(etudiant),
                    type: 'Paiement',
                    sujet: 'Confirmation de votre paiement INSEC',
                    titre: 'Paiement validé',
                    message: 'Votre versement a été validé et enregistré dans votre dossier financier.',
                    details: {
                        Reçu: String(versement.numeroRecu ?? '—'),
                        Montant: `${formaterMontant(versement.montant)} MRU`,
                        Date: formaterDate(String(versement.dateVersement)),
                        'Solde restant après paiement': `${formaterMontant(soldeApresPaiement ?? 0)} MRU`,
                    },
                });
                confirmationMiseEnFile = true;
            }
        }
        auditerModele(tx, acteur, 'Versement', v.id, 'updated', avant, apres);
    });
    return {
        message: v.statut === 'Rejetée'
            ? 'Versement rejeté. Le motif est enregistré et le solde reste inchangé.'
            : confirmationMiseEnFile
              ? 'Versement validé et solde actualisé. La confirmation de paiement a été mise en file d’envoi.'
              : 'Versement validé et solde actualisé. Aucune adresse e-mail valide : aucun e-mail envoyé.',
    };
});

/** Annule un versement validé par erreur (motif obligatoire) : il est retiré du total versé, l'historique est conservé. */
export const annulerVersement = operation('annulerVersement', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id(), motif: s.texteOptionnel(500) }), donnees);
    if (!v.motif?.trim()) erreurChamp('motif', 'Indiquez le motif de l’annulation.');
    await db.runTransaction(async (tx) => {
        const versementRef = col.versements().doc(v.id);
        const versement = await exiger(tx, versementRef, 'Versement introuvable.');
        if (versement.statut !== 'Validée') refuser('Seul un versement validé peut être annulé.');
        const inscriptionRef = col.inscriptions().doc(versement.inscriptionId);
        await exiger(tx, inscriptionRef, 'Inscription introuvable.');
        const apres = { statut: STATUT_VERSEMENT_ANNULE, motifAnnulation: v.motif!.trim(), annulePar: acteur.uid };
        tx.update(versementRef, { ...apres, annuleLe: FieldValue.serverTimestamp(), ...trace(acteur) });
        tx.update(inscriptionRef, { totalVerse: FieldValue.increment(-versement.montant), ...trace(acteur) });
        auditerModele(tx, acteur, 'Versement', v.id, 'updated', { statut: versement.statut }, apres);
    });
    return { message: 'Versement annulé : il ne compte plus dans le total versé. Son historique est conservé.' };
});

/** Lit une inscription à laquelle on peut associer un échéancier étudiant. */
async function inscriptionEcheancier(tx: FirebaseFirestore.Transaction, inscriptionId: string) {
    const ref = col.inscriptions().doc(inscriptionId);
    const inscription = await exiger(tx, ref, 'Inscription introuvable.');
    if (inscription.financeur === 'bumex') refuser('Cette inscription est prise en charge par BUMEX : aucun échéancier étudiant ne peut y être enregistré.');
    if (inscription.statut === 'annulée') refuser('Cette inscription est annulée : aucun échéancier ne peut y être enregistré.');
    return { ref, inscription };
}

/** Le total des échéances ne peut pas dépasser le montant net de l'inscription. */
function controlerTotalEcheances(echeances: Echeance[], inscription: FirebaseFirestore.DocumentData) {
    const total = echeances.reduce((t, e) => t + e.montant, 0);
    const net = montantNet(inscription as SituationFinanciere);
    if (total > net) erreurChamp('montant', `Le total des échéances (${formaterMontant(total)} MRU) dépasse le montant net de l’inscription (${formaterMontant(net)} MRU).`);
}

const trier = (echeances: Echeance[]) => [...echeances].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));

export const ajouterEcheance = operation('ajouterEcheance', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ inscriptionId: s.id(), libelle: s.texte(100), montant: s.entier(1), dateEcheance: s.date() }), donnees);
    await db.runTransaction(async (tx) => {
        const { ref, inscription } = await inscriptionEcheancier(tx, v.inscriptionId);
        const echeance = { id: randomUUID(), libelle: v.libelle, montant: v.montant, dateEcheance: v.dateEcheance };
        const echeances = trier([...(inscription.echeances ?? []), echeance]);
        controlerTotalEcheances(echeances, inscription);
        tx.update(ref, { echeances, ...trace(acteur) });
        auditerModele(tx, acteur, 'Echeance', echeance.id, 'created', null, { inscriptionId: v.inscriptionId, ...echeance });
    });
    return { message: 'Échéance ajoutée.' };
});

export const modifierEcheance = operation('modifierEcheance', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ inscriptionId: s.id(), id: s.id(), libelle: s.texte(100), montant: s.entier(1), dateEcheance: s.date() }), donnees);
    await db.runTransaction(async (tx) => {
        const { ref, inscription } = await inscriptionEcheancier(tx, v.inscriptionId);
        const existantes: Echeance[] = inscription.echeances ?? [];
        const avant = existantes.find((e) => e.id === v.id);
        if (!avant) refuser('Échéance introuvable.');
        const apres = { id: v.id, libelle: v.libelle, montant: v.montant, dateEcheance: v.dateEcheance };
        const echeances = trier(existantes.map((e) => (e.id === v.id ? apres : e)));
        controlerTotalEcheances(echeances, inscription);
        tx.update(ref, { echeances, ...trace(acteur) });
        auditerModele(tx, acteur, 'Echeance', v.id, 'updated', { ...avant }, apres);
    });
    return { message: 'Échéance modifiée.' };
});

export const supprimerEcheance = operation('supprimerEcheance', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ inscriptionId: s.id(), id: s.id() }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, ref, 'Inscription introuvable.');
        const existantes: Echeance[] = inscription.echeances ?? [];
        const avant = existantes.find((e) => e.id === v.id);
        if (!avant) refuser('Échéance introuvable.');
        tx.update(ref, { echeances: existantes.filter((e) => e.id !== v.id), ...trace(acteur) });
        auditerModele(tx, acteur, 'Echeance', v.id, 'deleted', { ...avant }, null);
    });
    return { message: 'Échéance supprimée.' };
});

/** Découpe le reste à payer en tranches égales ; remplace l'échéancier existant seulement si on le demande. */
export const genererEcheancier = operation('genererEcheancier', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({
        inscriptionId: s.id(),
        nombre: s.entier(2, 12),
        premiereDate: s.date(),
        intervalleMois: s.entier(1, 6),
        remplacer: z.boolean().default(false),
    }), donnees);
    let nombre = 0;
    await db.runTransaction(async (tx) => {
        const { ref, inscription } = await inscriptionEcheancier(tx, v.inscriptionId);
        const existantes: Echeance[] = inscription.echeances ?? [];
        if (existantes.length && !v.remplacer) refuser('Un échéancier existe déjà : cochez « Remplacer l’échéancier existant » pour le refaire.');
        const situation = inscription as unknown as SituationFinanciere;
        const reste = soldeRestant(situation);
        if (!estRecouvrable(situation) || reste <= 0) refuser('Il ne reste rien à payer sur cette inscription.');
        if (reste < v.nombre) erreurChamp('nombre', 'Le reste à payer est trop faible pour autant de tranches.');
        const echeances = decouperEcheancier(reste, v.nombre, v.premiereDate, v.intervalleMois).map((e) => ({ id: randomUUID(), ...e }));
        nombre = echeances.length;
        tx.update(ref, { echeances, ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', v.inscriptionId, 'updated', { echeances: existantes }, { echeances });
    });
    return { message: `Échéancier créé : ${nombre} tranches sur le reste à payer.` };
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
