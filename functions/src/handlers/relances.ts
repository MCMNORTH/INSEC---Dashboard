import { auditerModele, trace } from '../lib/audit.js';
import type { Acteur } from '../lib/contexte.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import {
    anneeCloturee, dateDuJour, estRecouvrable, formaterMontant, montantEnRetard, montantNet, ROLES_FINANCE, soldeRestant, type Echeance, type SituationFinanciere,
} from '../shared/domaine.js';

// Rappels de paiement envoyés uniquement à la demande de la finance (jamais automatiquement) :
// possibles dès qu'il reste un montant à payer, au plus un par inscription et par jour, tracés dans le journal d'audit.

type Resultat = 'envoyee' | 'deja-relancee' | 'rien-a-payer' | 'annee-cloturee' | 'sans-email';

const emailValide = (valeur: unknown): valeur is string => typeof valeur === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim());
const dateFr = (iso: string) => iso.split('-').reverse().join('/');

async function relancer(inscriptionId: string, acteur: Acteur, jour: string): Promise<Resultat> {
    return db.runTransaction(async (tx) => {
        const inscriptionRef = col.inscriptions().doc(inscriptionId);
        const inscription = await exiger(tx, inscriptionRef, 'Inscription introuvable.');
        const etudiant = await exiger(tx, col.etudiants().doc(inscription.etudiantId), 'Étudiant introuvable.');
        const journalRef = col.journalEmails().doc(`relance-${inscriptionId}-${jour}`);
        if ((await tx.get(journalRef)).exists) return 'deja-relancee';
        const situation = inscription as unknown as SituationFinanciere;
        if (anneeCloturee(inscription.anneeId)) return 'annee-cloturee';
        const reste = soldeRestant(situation);
        if (inscription.statut === 'annulée' || !estRecouvrable(situation) || reste <= 0) return 'rien-a-payer';
        if (!emailValide(etudiant.email)) return 'sans-email';
        const retard = montantEnRetard(situation, jour);
        const net = montantNet(situation);
        const paye = Math.min(Number(inscription.totalVerse ?? 0), net);
        const echeances: Echeance[] = [...(inscription.echeances ?? [])].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
        const premiereEchue = echeances.find((e) => e.dateEcheance < jour);
        const prochaine = echeances.find((e) => e.dateEcheance >= jour);
        const prenom = String(etudiant.prenom ?? '').trim() || nomComplet(etudiant);
        const dossier = `${inscription.formationId} ${inscription.anneeId}`;
        mettreEnFileEmail(tx, {
            destinataire: etudiant.email.trim(),
            nomDestinataire: nomComplet(etudiant),
            type: 'Relance',
            sujet: retard > 0 ? 'INSEC · Rappel de paiement' : 'INSEC · Point sur vos paiements',
            titre: retard > 0 ? 'Rappel de paiement' : 'Point sur vos paiements',
            message: `Bonjour ${prenom}, voici le point sur les frais de votre inscription ${dossier} : `
                + `vous avez réglé ${formaterMontant(paye)} MRU sur ${formaterMontant(net)} MRU, il vous reste ${formaterMontant(reste)} MRU à payer. `
                + (retard > 0
                    ? `Sauf erreur de notre part, ${formaterMontant(retard)} MRU sont déjà échus${premiereEchue ? ` (échéance du ${dateFr(premiereEchue.dateEcheance)})` : ''} : merci de régulariser auprès du secrétariat de l’INSEC. `
                    : 'Merci de prévoir ce règlement auprès du secrétariat de l’INSEC. ')
                + 'Si vous avez déjà réglé ce montant, merci de transmettre votre justificatif au service financier.',
            details: {
                'Montant total': `${formaterMontant(net)} MRU`,
                'Déjà payé': `${formaterMontant(paye)} MRU`,
                'Reste à payer': `${formaterMontant(reste)} MRU`,
                ...(retard > 0 ? { 'Dont en retard': `${formaterMontant(retard)} MRU` } : {}),
                'Prochaine échéance': prochaine ? `${dateFr(prochaine.dateEcheance)} · ${formaterMontant(prochaine.montant)} MRU` : '—',
            },
        }, journalRef.id);
        tx.update(inscriptionRef, { derniereRelanceLe: jour, nbRelances: FieldValue.increment(1), ...trace(acteur) });
        auditerModele(tx, acteur, 'Relance', journalRef.id, 'created', null, { inscriptionId, etudiantId: inscription.etudiantId, resteAPayer: reste, montantEnRetard: retard });
        return 'envoyee';
    });
}

/** Envoie à la demande un rappel de paiement (déjà payé, reste à payer, retard éventuel) pour une inscription. */
export const relancerPaiement = operation('relancerPaiement', ROLES_FINANCE, async (donnees, acteur) => {
    const { inscriptionId } = valider(z.object({ inscriptionId: s.id() }), donnees);
    const resultat = await relancer(inscriptionId, acteur, dateDuJour());
    if (resultat === 'deja-relancee') refuser('Un rappel a déjà été envoyé aujourd’hui pour cette inscription.');
    if (resultat === 'rien-a-payer') refuser('Il ne reste rien à payer sur cette inscription : aucun rappel à envoyer.');
    if (resultat === 'annee-cloturee') refuser('Cette année scolaire est clôturée : les rappels ne sont plus envoyés.');
    if (resultat === 'sans-email') refuser('Aucune adresse e-mail valide pour cet étudiant : corrigez sa fiche avant d’envoyer un rappel.');
    return { message: 'Rappel de paiement mis en file d’envoi.' };
});

/** Relance d'un coup tous les étudiants en retard sur une année scolaire. */
export const relancerTousLesRetards = operation('relancerTousLesRetards', ROLES_FINANCE, async (donnees, acteur) => {
    const { anneeId } = valider(z.object({ anneeId: s.id() }), donnees);
    const jour = dateDuJour();
    const candidates = (await col.inscriptions().where('anneeId', '==', anneeId).where('statut', '==', 'active').get()).docs
        .filter((d) => estRecouvrable(d.data() as never) && montantEnRetard(d.data() as never, jour) > 0);
    const compte: Record<Resultat, number> = { 'envoyee': 0, 'deja-relancee': 0, 'rien-a-payer': 0, 'annee-cloturee': 0, 'sans-email': 0 };
    for (const d of candidates) compte[await relancer(d.id, acteur, jour)] += 1;
    const parties = [
        `${compte.envoyee} relance(s) mise(s) en file d’envoi`,
        compte['deja-relancee'] ? `${compte['deja-relancee']} déjà relancé(s) aujourd’hui` : '',
        compte['sans-email'] ? `${compte['sans-email']} sans adresse e-mail valide` : '',
    ].filter(Boolean);
    return { ...compte, message: candidates.length ? `${parties.join(' · ')}.` : 'Aucun étudiant en retard de paiement sur cette année.' };
});
