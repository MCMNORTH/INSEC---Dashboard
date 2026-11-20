import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { ajouterEcheance, ajouterVersement } from '../src/handlers/finances.js';
import { db } from '../src/lib/firebase.js';
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

    it('envoie un rappel détaillé (payé, reste, retard) à un étudiant en retard, une seule fois par jour', async () => {
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T1', montant: 8000, dateEcheance: '2025-01-10' }, finance);
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'T2', montant: 8000, dateEcheance: '2099-01-10' }, finance);
        await appeler(ajouterVersement, { inscriptionId, montant: 3000, dateVersement: '2026-09-20', statut: 'Validée', modePaiement: 'Espèces' }, finance);
        await appeler(relancerPaiement, { inscriptionId }, finance);
        const [email] = (await liste('journalEmails')).filter((e) => e.type === 'Relance');
        expect(email).toMatchObject({ destinataire: 'awa@example.com', sujet: 'INSEC · Rappel de paiement', statut: 'En attente' });
        expect(email.message).toContain('vous avez réglé 3 000 MRU sur 16 000 MRU, il vous reste 13 000 MRU à payer');
        expect(email.message).toContain('5 000 MRU sont déjà échus (échéance du 10/01/2025)');
        expect(email.details).toEqual({
            'Montant total': '16 000 MRU', 'Déjà payé': '3 000 MRU', 'Reste à payer': '13 000 MRU',
            'Dont en retard': '5 000 MRU', 'Prochaine échéance': '10/01/2099 · 8 000 MRU',
        });
        expect(await doc(`inscriptions/${inscriptionId}`)).toMatchObject({ nbRelances: 1 });

        await attendreErreur(appeler(relancerPaiement, { inscriptionId }, finance), 'failed-precondition');
        expect((await liste('journalEmails')).filter((e) => e.type === 'Relance')).toHaveLength(1);
        expect((await liste('journalAudit')).some((a) => a.modele === 'Relance')).toBe(true);
    });

    it('envoie un simple point sur les paiements quand rien n’est en retard', async () => {
        await appeler(relancerPaiement, { inscriptionId }, finance);
        const [email] = (await liste('journalEmails')).filter((e) => e.type === 'Relance');
        expect(email).toMatchObject({ sujet: 'INSEC · Point sur vos paiements', titre: 'Point sur vos paiements' });
        expect(email.message).toContain('vous avez réglé 0 MRU sur 16 000 MRU, il vous reste 16 000 MRU à payer');
        expect(email.details).not.toHaveProperty('Dont en retard');
    });

    it('refuse un rappel quand tout est payé, pour une année clôturée ou sans adresse e-mail valide', async () => {
        await appeler(ajouterVersement, { inscriptionId, montant: 16000, dateVersement: '2026-09-20', statut: 'Validée', modePaiement: 'Espèces' }, finance);
        await attendreErreur(appeler(relancerPaiement, { inscriptionId }, finance), 'failed-precondition');
        await db.doc(`inscriptions/${inscriptionId}`).update({ totalVerse: 0, anneeId: '2025-2026' });
        await attendreErreur(appeler(relancerPaiement, { inscriptionId }, finance), 'failed-precondition');
        expect((await liste('journalEmails')).filter((e) => e.type === 'Relance')).toHaveLength(0);
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

    it('réserve les rappels à la finance et à l’administration', async () => {
        for (const role of ['consultation', 'admin_lecture', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(relancerPaiement, { inscriptionId }, await acteur(role)), 'permission-denied');
            await attendreErreur(appeler(relancerTousLesRetards, { anneeId: '2026-2027' }, await acteur(role)), 'permission-denied');
        }
    });
});
