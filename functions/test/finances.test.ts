import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { ajouterEcheance, ajouterVersement, modifierSituationFinanciere } from '../src/handlers/finances.js';
import { montantEnRetard, montantNet, soldeRestant, statutPaiement } from '../src/shared/domaine.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const etudiant = (email: string) => ({
    nom: 'Ba', prenom: 'Awa', email, statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1,
    dateInscription: '2026-09-20', ueIds: ['TEC111'],
});
const versement = { montant: 30000, dateVersement: '2026-09-20', statut: 'Validée', modePaiement: 'Espèces', reference: 'CAISSE-1' };

describe('Suivi financier', () => {
    let finance: ActeurTest;
    let inscriptionId: string;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        finance = await acteur('finance');
        await appeler(creerEtudiant, etudiant('awa@example.com'), await acteur('admin'));
        inscriptionId = (await liste('inscriptions'))[0].id;
    });

    it('calcule remise, versements et solde par inscription, avec numéro de reçu', async () => {
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 100000, montantRemise: 10000, noteFinanciere: 'Bourse' }, finance);
        const { numeroRecu } = await appeler(ajouterVersement, { ...versement, inscriptionId }, finance);
        const inscription = (await doc(`inscriptions/${inscriptionId}`)) as never;
        expect(montantNet(inscription)).toBe(90000);
        expect(soldeRestant(inscription)).toBe(60000);
        expect(statutPaiement(inscription)).toBe('Partiel');
        const maintenant = new Date();
        expect(numeroRecu).toBe(`REC-${maintenant.getUTCFullYear()}${String(maintenant.getUTCMonth() + 1).padStart(2, '0')}-000001`);
        const [email] = await liste('journalEmails');
        expect(email).toMatchObject({ destinataire: 'awa@example.com', type: 'Paiement', statut: 'En attente' });
        expect(email.details.Montant).toBe('30 000 MRU');
    });

    it('ne compte pas un versement en attente comme payé', async () => {
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 50000, montantRemise: 0 }, finance);
        await appeler(ajouterVersement, { ...versement, inscriptionId, statut: 'En attente' }, finance);
        expect(soldeRestant((await doc(`inscriptions/${inscriptionId}`)) as never)).toBe(50000);
        expect(await liste('journalEmails')).toHaveLength(0);
    });

    it('signale une échéance dépassée', async () => {
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 100000, montantRemise: 0 }, finance);
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'Première tranche', montant: 40000, dateEcheance: '2025-01-01' }, finance);
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'Deuxième tranche', montant: 40000, dateEcheance: '2099-01-01' }, finance);
        expect(montantEnRetard((await doc(`inscriptions/${inscriptionId}`)) as never)).toBe(40000);
    });

    it('rattache le versement à l’inscription indiquée uniquement', async () => {
        await appeler(creerEtudiant, etudiant('moussa@example.com'), await acteur('admin'));
        const autre = (await liste('inscriptions')).find((i) => i.id !== inscriptionId)!;
        await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 1000 }, finance);
        const versements = await liste('versements');
        expect(versements).toHaveLength(1);
        expect(versements[0].inscriptionId).toBe(inscriptionId);
        expect((await doc(`inscriptions/${autre.id}`))?.totalVerse).toBe(0);
    });

    it('refuse une remise supérieure au montant dû', async () => {
        await attendreErreur(appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 1000, montantRemise: 2000 }, finance), 'invalid-argument', 'montantRemise');
    });

    it('refuse les opérations financières aux rôles non autorisés', async () => {
        for (const role of ['enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(ajouterVersement, { ...versement, inscriptionId }, await acteur(role)), 'permission-denied');
        }
        await attendreErreur(appeler(ajouterVersement, { ...versement, inscriptionId }, null), 'unauthenticated');
    });
});
