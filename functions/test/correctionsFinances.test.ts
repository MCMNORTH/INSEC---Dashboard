import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import {
    ajouterEcheance, ajouterVersement, annulerVersement, genererEcheancier, modifierEcheance, modifierSituationFinanciere, supprimerEcheance,
    traiterVersement,
} from '../src/handlers/finances.js';
import { ajouterMois, decouperEcheancier, soldeRestant } from '../src/shared/domaine.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const versement = { dateVersement: '2026-09-20', modePaiement: 'Espèces', reference: null, note: null };

describe('Découpage d’un échéancier (règle partagée)', () => {
    it('répartit le montant en tranches entières, le reste sur la dernière', () => {
        expect(decouperEcheancier(100000, 3, '2026-10-15', 1)).toEqual([
            { libelle: 'Tranche 1/3', montant: 33333, dateEcheance: '2026-10-15' },
            { libelle: 'Tranche 2/3', montant: 33333, dateEcheance: '2026-11-15' },
            { libelle: 'Tranche 3/3', montant: 33334, dateEcheance: '2026-12-15' },
        ]);
    });

    it('ramène le jour à la fin du mois et change d’année', () => {
        expect(ajouterMois('2027-01-31', 1)).toBe('2027-02-28');
        expect(ajouterMois('2026-11-30', 3)).toBe('2027-02-28');
        expect(ajouterMois('2026-12-15', 1)).toBe('2027-01-15');
    });
});

describe('Corriger une erreur en Finances', () => {
    let finance: ActeurTest;
    let inscriptionId: string;
    const inscription = async () => (await doc(`inscriptions/${inscriptionId}`))!;

    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        finance = await acteur('finance');
        await appeler(creerEtudiant, {
            nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027',
            anneeParcours: 1, ueIds: ['TEC111', 'TEC119'],
        }, await acteur('admin'));
        inscriptionId = (await liste('inscriptions'))[0].id;
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 100000, montantRemise: 0 }, finance);
    });

    it('valide un versement en attente une seule fois et met à jour le solde', async () => {
        const { id } = await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 30000, statut: 'En attente' }, finance);
        await appeler(traiterVersement, { id, statut: 'Validée' }, finance);
        expect((await inscription()).totalVerse).toBe(30000);
        await attendreErreur(appeler(traiterVersement, { id, statut: 'Validée' }, finance), 'failed-precondition');
        expect((await inscription()).totalVerse).toBe(30000);
        expect((await liste('journalEmails')).some((e) => e.type === 'Paiement')).toBe(true);
    });

    it('rejette un versement en attente avec un motif obligatoire, sans toucher au solde', async () => {
        const { id } = await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 30000, statut: 'En attente' }, finance);
        await attendreErreur(appeler(traiterVersement, { id, statut: 'Rejetée' }, finance), 'invalid-argument', 'motif');
        await appeler(traiterVersement, { id, statut: 'Rejetée', motif: 'Chèque sans provision' }, finance);
        expect(await doc(`versements/${id}`)).toMatchObject({ statut: 'Rejetée', motifRejet: 'Chèque sans provision' });
        expect((await inscription()).totalVerse).toBe(0);
    });

    it('annule un versement validé par erreur : retiré du total, historique conservé', async () => {
        const { id } = await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 30000, statut: 'Validée' }, finance);
        await attendreErreur(appeler(annulerVersement, { id }, finance), 'invalid-argument', 'motif');
        await appeler(annulerVersement, { id, motif: 'Erreur de saisie : 3 000 MRU' }, finance);
        expect(await doc(`versements/${id}`)).toMatchObject({ statut: 'Annulée', motifAnnulation: 'Erreur de saisie : 3 000 MRU' });
        expect((await inscription()).totalVerse).toBe(0);
        expect(soldeRestant((await inscription()) as never)).toBe(100000);
        await attendreErreur(appeler(annulerVersement, { id, motif: 'deux fois' }, finance), 'failed-precondition');
        expect((await liste('journalAudit')).some((a) => a.modele === 'Versement' && a.modeleId === id && a.action === 'updated')).toBe(true);
    });

    it('modifie et supprime une échéance, sans dépasser le montant net', async () => {
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T1', montant: 40000, dateEcheance: '2026-11-01' }, finance);
        const [e] = (await inscription()).echeances;
        await appeler(modifierEcheance, { inscriptionId, id: e.id, libelle: 'Première tranche', montant: 50000, dateEcheance: '2026-11-15' }, finance);
        expect((await inscription()).echeances).toEqual([{ id: e.id, libelle: 'Première tranche', montant: 50000, dateEcheance: '2026-11-15' }]);
        await attendreErreur(appeler(modifierEcheance, { inscriptionId, id: e.id, libelle: 'Trop', montant: 150000, dateEcheance: '2026-11-15' }, finance), 'invalid-argument', 'montant');
        await attendreErreur(appeler(ajouterEcheance, { inscriptionId, libelle: 'T2', montant: 60000, dateEcheance: '2026-12-01' }, finance), 'invalid-argument', 'montant');
        await appeler(supprimerEcheance, { inscriptionId, id: e.id }, finance);
        expect((await inscription()).echeances).toEqual([]);
    });

    it('génère l’échéancier sur le reste à payer et ne l’écrase qu’à la demande', async () => {
        await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 10000, statut: 'Validée' }, finance);
        await appeler(genererEcheancier, { inscriptionId, nombre: 3, premiereDate: '2026-11-05', intervalleMois: 1 }, finance);
        const echeances = (await inscription()).echeances;
        expect(echeances.map((e: { montant: number }) => e.montant)).toEqual([30000, 30000, 30000]);
        expect(echeances.map((e: { dateEcheance: string }) => e.dateEcheance)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
        await attendreErreur(appeler(genererEcheancier, { inscriptionId, nombre: 2, premiereDate: '2026-11-05', intervalleMois: 2 }, finance), 'failed-precondition');
        await appeler(genererEcheancier, { inscriptionId, nombre: 2, premiereDate: '2026-11-05', intervalleMois: 2, remplacer: true }, finance);
        expect((await inscription()).echeances).toHaveLength(2);
    });

    it('refuse ces corrections aux rôles non autorisés', async () => {
        const { id } = await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 30000, statut: 'Validée' }, finance);
        for (const role of ['enseignant', 'etudiant'] as const) {
            const qui = await acteur(role);
            await attendreErreur(appeler(annulerVersement, { id, motif: 'x' }, qui), 'permission-denied');
            await attendreErreur(appeler(traiterVersement, { id, statut: 'Validée' }, qui), 'permission-denied');
            await attendreErreur(appeler(genererEcheancier, { inscriptionId, nombre: 2, premiereDate: '2026-11-05', intervalleMois: 1 }, qui), 'permission-denied');
        }
        await attendreErreur(appeler(annulerVersement, { id, motif: 'x' }, null), 'unauthenticated');
    });
});
