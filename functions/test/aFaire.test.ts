import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { creerExamen } from '../src/handlers/examens.js';
import { ajouterEcheance, ajouterVersement, modifierSituationFinanciere } from '../src/handlers/finances.js';
import { tableauDeBordAdmin } from '../src/handlers/tableauDeBord.js';
import { acteur, appeler, attendreErreur, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const dansJours = (jours: number) => new Date(Date.now() + jours * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '+00:00');
const examen = (dateExamen: string) => ({
    ueId: 'TEC111', anneeId: '2026-2027', session: 'Normale', dateExamen, salle: 'A1', noteSur: 20, seuilValidation: 10, statut: 'Planifié',
});

describe('Tableau de bord : à faire aujourd’hui', () => {
    let admin: ActeurTest;
    let inscriptionId: string;
    const taches = async () => (await appeler(tableauDeBordAdmin, { anneeId: '2026-2027' }, admin)).aFaire as { cle: string; niveau: string; titre: string }[];

    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
        await appeler(creerEtudiant, {
            nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1, ueIds: ['TEC111'],
        }, admin);
        inscriptionId = (await liste('inscriptions'))[0].id;
    });

    it('ne signale rien quand tout est à jour', async () => {
        expect(await taches()).toEqual([]);
    });

    it('signale les retards de paiement, les montants à fixer et les versements en attente', async () => {
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T1', montant: 8000, dateEcheance: '2025-01-01' }, admin);
        await appeler(ajouterVersement, { inscriptionId, montant: 1000, dateVersement: '2026-09-20', statut: 'En attente', modePaiement: 'Espèces' }, admin);
        const cles = (await taches()).map((t) => t.cle);
        expect(cles).toEqual(expect.arrayContaining(['retards', 'versements-en-attente']));
        expect((await taches())[0].niveau).toBe('danger');

        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 0, montantRemise: 0 }, admin);
        expect((await taches()).map((t) => t.cle)).toContain('a-chiffrer');
    });

    it('signale les sujets non reçus et les convocations non envoyées d’une épreuve proche', async () => {
        const { id } = await appeler(creerExamen, examen(dansJours(2)), admin);
        const cles = (await taches()).map((t) => t.cle);
        expect(cles).toEqual(expect.arrayContaining([`sujets-${id}`, `convocations-${id}`]));
    });

    it('signale les copies non renvoyées à l’INTEC après une épreuve passée', async () => {
        const { id } = await appeler(creerExamen, examen(dansJours(-5)), admin);
        expect((await taches()).map((t) => t.cle)).toContain(`copies-${id}`);
    });

    it('reste réservé à l’administration', async () => {
        await attendreErreur(appeler(tableauDeBordAdmin, {}, await acteur('finance')), 'permission-denied');
    });
});
