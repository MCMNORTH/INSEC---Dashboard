import { auditerModele, trace } from '../lib/audit.js';
import type { Acteur } from '../lib/contexte.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import {
    dateDuJour, estRecouvrable, formaterMontant, montantEnRetard, ROLES_FINANCE, soldeRestant, type Echeance, type SituationFinanciere,
} from '../shared/domaine.js';

// Relances de paiement envoyées à la demande de la finance (pas d'envoi automatique) :
// au plus une relance par inscription et par jour, tracée dans le journal d'audit.

type Resultat = 'envoyee' | 'deja-relancee' | 'sans-retard' | 'sans-email';

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
        const retard = montantEnRetard(situation, jour);
        if (inscription.statut !== 'active' || !estRecouvrable(situation) || retard <= 0) return 'sans-retard';
        if (!emailValide(etudiant.email)) return 'sans-email';
        const echeances: Echeance[] = [...(inscription.echeances ?? [])].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
        const premiereEchue = echeances.find((e) => e.dateEcheance < jour);
        const prochaine = echeances.find((e) => e.dateEcheance >= jour);
        mettreEnFileEmail(tx, {
            destinataire: etudiant.email.trim(),
            nomDestinataire: nomComplet(etudiant),
            type: 'Relance',
            sujet: 'INSEC · Rappel de paiement',
            titre: 'Rappel de paiement',
            message: `Bonjour ${String(etudiant.prenom ?? '').trim() || nomComplet(etudiant)}, sauf erreur de notre part, un montant de `
                + `${formaterMontant(retard)} MRU est échu sur votre inscription ${inscription.formationId} ${inscription.anneeId}`
                + `${premiereEchue ? ` (échéance du ${dateFr(premiereEchue.dateEcheance)})` : ''}. `
                + 'Merci de régulariser auprès du secrétariat de l’INSEC. Si vous avez déjà réglé ce montant, merci de transmettre votre justificatif au service financier.',
            details: {
                'Montant en retard': `${formaterMontant(retard)} MRU`,
                'Solde restant': `${formaterMontant(soldeRestant(situation))} MRU`,
                'Prochaine échéance': prochaine ? `${dateFr(prochaine.dateEcheance)} · ${formaterMontant(prochaine.montant)} MRU` : '—',
            },
        }, journalRef.id);
        tx.update(inscriptionRef, { derniereRelanceLe: jour, nbRelances: FieldValue.increment(1), ...trace(acteur) });
        auditerModele(tx, acteur, 'Relance', journalRef.id, 'created', null, { inscriptionId, etudiantId: inscription.etudiantId, montantEnRetard: retard });
        return 'envoyee';
    });
}

/** Relance un étudiant en retard de paiement sur une inscription. */
export const relancerPaiement = operation('relancerPaiement', ROLES_FINANCE, async (donnees, acteur) => {
    const { inscriptionId } = valider(z.object({ inscriptionId: s.id() }), donnees);
    const resultat = await relancer(inscriptionId, acteur, dateDuJour());
    if (resultat === 'deja-relancee') refuser('Cet étudiant a déjà été relancé aujourd’hui pour cette inscription.');
    if (resultat === 'sans-retard') refuser('Aucun montant en retard sur cette inscription : rien à relancer.');
    if (resultat === 'sans-email') refuser('Aucune adresse e-mail valide pour cet étudiant : corrigez sa fiche avant de le relancer.');
    return { message: 'Relance de paiement mise en file d’envoi.' };
});

/** Relance d'un coup tous les étudiants en retard sur une année scolaire. */
export const relancerTousLesRetards = operation('relancerTousLesRetards', ROLES_FINANCE, async (donnees, acteur) => {
    const { anneeId } = valider(z.object({ anneeId: s.id() }), donnees);
    const jour = dateDuJour();
    const candidates = (await col.inscriptions().where('anneeId', '==', anneeId).where('statut', '==', 'active').get()).docs
        .filter((d) => estRecouvrable(d.data() as never) && montantEnRetard(d.data() as never, jour) > 0);
    const compte: Record<Resultat, number> = { 'envoyee': 0, 'deja-relancee': 0, 'sans-retard': 0, 'sans-email': 0 };
    for (const d of candidates) compte[await relancer(d.id, acteur, jour)] += 1;
    const parties = [
        `${compte.envoyee} relance(s) mise(s) en file d’envoi`,
        compte['deja-relancee'] ? `${compte['deja-relancee']} déjà relancé(s) aujourd’hui` : '',
        compte['sans-email'] ? `${compte['sans-email']} sans adresse e-mail valide` : '',
    ].filter(Boolean);
    return { ...compte, message: candidates.length ? `${parties.join(' · ')}.` : 'Aucun étudiant en retard de paiement sur cette année.' };
});
