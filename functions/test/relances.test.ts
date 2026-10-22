import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { ajouterEcheance } from '../src/handlers/finances.js';
import { relancerPaiement, relancerTousLesRetards } from '../src/handlers/relances.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const etudiant = (email: string | null, nom = 'Ba') => ({
    nom, prenom: 'Awa', email, statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1, ueIds: ['TEC111'],
});

describe('Relances de paiement', () => {
    let finance: ActeurTest;
    let admin: ActeurTest;
    let inscriptionId: string;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        finance = await acteur('finance');
        admin = await acteur('admin');
        await appeler(creerEtudiant, etudiant('awa@example.com'), admin);
        inscriptionId = (await liste('inscriptions'))[0].id;
    });

    it('envoie une relance détaillée à un étudiant en retard, une seule fois par jour', async () => {
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T1', montant: 8000, dateEcheance: '2025-01-10' }, finance);
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T2', montant: 8000, dateEcheance: '2099-01-10' }, finance);
        await appeler(relancerPaiement, { inscriptionId }, finance);
        const [email] = (await liste('journalEmails')).filter((e) => e.type === 'Relance');
        expect(email).toMatchObject({ destinataire: 'awa@example.com', sujet: 'INSEC · Rappel de paiement', statut: 'En attente' });
        expect(email.message).toContain('8 000 MRU est échu sur votre inscription DGC 2026-2027 (échéance du 10/01/2025)');
        expect(email.details).toMatchObject({ 'Montant en retard': '8 000 MRU', 'Solde restant': '16 000 MRU', 'Prochaine échéance': '10/01/2099 · 8 000 MRU' });
        expect(await doc(`inscriptions/${inscriptionId}`)).toMatchObject({ nbRelances: 1 });

        await attendreErreur(appeler(relancerPaiement, { inscriptionId }, finance), 'failed-precondition');
        expect((await liste('journalEmails')).filter((e) => e.type === 'Relance')).toHaveLength(1);
        expect((await liste('journalAudit')).some((a) => a.modele === 'Relance')).toBe(true);
    });

    it('refuse de relancer sans retard ou sans adresse e-mail valide', async () => {
        await attendreErreur(appeler(relancerPaiement, { inscriptionId }, finance), 'failed-precondition');
        await appeler(creerEtudiant, etudiant(null, 'Sans'), admin);
        const sansEmail = (await liste('inscriptions')).find((i) => i.id !== inscriptionId)!;
        await appeler(ajouterEcheance, { inscriptionId: sansEmail.id, libelle: 'T1', montant: 8000, dateEcheance: '2025-01-10' }, finance);
        await attendreErreur(appeler(relancerPaiement, { inscriptionId: sansEmail.id }, finance), 'failed-precondition');
    });

    it('relance tous les retards d’une année et compte les cas particuliers', async () => {
        await appeler(creerEtudiant, etudiant(null, 'Sans'), admin);
        for (const i of await liste('inscriptions')) {
            await appeler(ajouterEcheance, { inscriptionId: i.id, libelle: 'T1', montant: 8000, dateEcheance: '2025-01-10' }, finance);
        }
        const resultat = await appeler(relancerTousLesRetards, { anneeId: '2026-2027' }, finance);
        expect(resultat).toMatchObject({ envoyee: 1, 'sans-email': 1 });
        const second = await appeler(relancerTousLesRetards, { anneeId: '2026-2027' }, finance);
        expect(second).toMatchObject({ envoyee: 0, 'deja-relancee': 1 });
    });

    it('réserve les relances à la finance et à l’administration', async () => {
        for (const role of ['enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(relancerPaiement, { inscriptionId }, await acteur(role)), 'permission-denied');
            await attendreErreur(appeler(relancerTousLesRetards, { anneeId: '2026-2027' }, await acteur(role)), 'permission-denied');
        }
    });
});
