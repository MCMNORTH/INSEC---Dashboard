import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { mettreEnFileRappelMensuel } from '../lib/email.js';
import { col, nomComplet } from '../lib/donnees.js';
import { db, REGION } from '../lib/firebase.js';
import { formaterMontant, montantNet, soldeRestant, type SituationFinanciere } from '../shared/domaine.js';

const emailValide = (valeur: unknown): valeur is string => typeof valeur === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());

function moisCourant(date: Date): string {
    const parties = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nouakchott', year: 'numeric', month: '2-digit' }).formatToParts(date);
    const annee = parties.find((partie) => partie.type === 'year')?.value;
    const mois = parties.find((partie) => partie.type === 'month')?.value;
    return `${annee}-${mois}`;
}

/** Place une fois par mois un rappel uniquement pour les dossiers actifs et débiteurs. */
export async function mettreEnFileRappelsMensuels(dateReference = new Date()): Promise<{ mois: string; candidats: number; misEnFile: number }> {
    const mois = moisCourant(dateReference);
    const dossiers = await col.inscriptions().where('statut', '==', 'active').get();
    const dettes = dossiers.docs.filter((dossierDoc) => {
        const dossier = dossierDoc.data();
        return dossier.financeur !== 'bumex' && soldeRestant(dossier as SituationFinanciere) > 0 && Boolean(dossier.etudiantId);
    });
    const etudiantIds = [...new Set(dettes.map((dossierDoc) => String(dossierDoc.get('etudiantId'))))];
    const etudiants = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (let debut = 0; debut < etudiantIds.length; debut += 300) {
        const ids = etudiantIds.slice(debut, debut + 300);
        const instantanes = await db.getAll(...ids.map((id) => col.etudiants().doc(id)));
        instantanes.forEach((instantane, index) => etudiants.set(ids[index], instantane));
    }
    const candidats = dettes.flatMap((dossierDoc) => {
        const etudiantId = String(dossierDoc.get('etudiantId'));
        const etudiantDoc = etudiants.get(etudiantId);
        return etudiantDoc?.exists && emailValide(etudiantDoc.get('email'))
            ? [{ dossierDoc, etudiantDoc }]
            : [];
    });
    let misEnFile = 0;

    async function preparerRappel(dossierDoc: (typeof dossiers.docs)[number], etudiantDoc: FirebaseFirestore.DocumentSnapshot) {
        const refJournal = col.journalEmails().doc(`rappel-${dossierDoc.id}-${mois}`);
        const cree = await db.runTransaction(async (tx) => {
            const [dossierActuel, etudiantActuel, rappelExistant] = await Promise.all([
                tx.get(dossierDoc.ref),
                tx.get(etudiantDoc.ref),
                tx.get(refJournal),
            ]);
            if (!dossierActuel.exists || !etudiantActuel.exists || rappelExistant.exists) return false;
            const situation = dossierActuel.data()!;
            const personne = etudiantActuel.data()!;
            const situationFinanciere = situation as SituationFinanciere;
            const solde = soldeRestant(situationFinanciere);
            if (situation.statut !== 'active' || situation.financeur === 'bumex' || solde <= 0 || !emailValide(personne.email)) return false;
            mettreEnFileRappelMensuel(tx, {
                destinataire: personne.email.trim(),
                nomDestinataire: nomComplet(personne),
                type: 'Rappel de solde',
                sujet: `Rappel de solde INSEC · ${mois}`,
                titre: 'Point mensuel sur votre scolarité',
                message: 'Selon les données de notre service financier, un solde reste dû pour votre inscription. Si vous avez déjà réglé ce montant, merci de transmettre votre justificatif au service financier afin que votre dossier soit mis à jour.',
                details: {
                    Année: String(situation.anneeId ?? ''),
                    'Total de la scolarité': `${formaterMontant(montantNet(situationFinanciere))} MRU`,
                    'Montant enregistré comme payé': `${formaterMontant(situation.totalVerse ?? 0)} MRU`,
                    'Solde restant dû': `${formaterMontant(solde)} MRU`,
                },
                inscriptionId: dossierDoc.id,
                mois,
            });
            return true;
        });
        return cree ? 1 : 0;
    }

    for (let debut = 0; debut < candidats.length; debut += 10) {
        const groupe = candidats.slice(debut, debut + 10);
        const resultats = await Promise.all(groupe.map(({ dossierDoc, etudiantDoc }) => preparerRappel(dossierDoc, etudiantDoc)));
        misEnFile += resultats.reduce<number>((total, resultat) => total + resultat, 0);
    }
    logger.info('rappels_mensuels_prepares', { mois, candidats: candidats.length, misEnFile });
    return { mois, candidats: candidats.length, misEnFile };
}

/** Envoi planifié le 5 de chaque mois à 09:00, heure de Nouakchott. */
export const envoyerRappelsMensuels = onSchedule(
    { schedule: '0 9 5 * *', timeZone: 'Africa/Nouakchott', region: REGION, retryCount: 2, timeoutSeconds: 300 },
    async () => { await mettreEnFileRappelsMensuels(); },
);
