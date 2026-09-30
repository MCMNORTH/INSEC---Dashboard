import { beforeEach, describe, expect, it } from 'vitest';
import { confirmationCandidature, convertirCandidature, deciderCandidature, deposerCandidature } from '../src/handlers/candidatures.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const candidature = {
    nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', telephone: '22000000', dernierDiplome: 'Baccalauréat',
    formationId: 'DGC', anneeId: '2026-2027', motivation: 'Devenir expert-comptable.',
};
const conversion = { anneeParcours: 1, dateInscription: '2026-09-20', numeroIntec: 'INTEC-001', montantDu: 50000 };

describe('Admissions', () => {
    let admin: ActeurTest;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
    });

    it('permet à un candidat de déposer une candidature publique et de consulter sa confirmation', async () => {
        const { reference } = await appeler(deposerCandidature, candidature, null);
        expect(reference).toMatch(/^ADM-\d{6}-[A-Z0-9]{6}$/);
        expect(await doc(`candidatures/${reference}`)).toMatchObject({ email: 'awa@example.com', statut: 'Nouvelle' });
        expect(await appeler(confirmationCandidature, { reference }, null)).toEqual({ reference, email: 'awa@example.com' });
        const [email] = await liste('journalEmails');
        expect(email).toMatchObject({ type: 'Candidature', destinataire: 'awa@example.com' });
        const [audit] = await liste('journalAudit');
        expect(audit).toMatchObject({ acteurId: null, modele: 'Candidature', action: 'created' });
    });

    it('refuse une seconde candidature avec le même e-mail pour la même année', async () => {
        await appeler(deposerCandidature, candidature, null);
        await attendreErreur(appeler(deposerCandidature, candidature, null), 'already-exists', 'anneeId');
        await appeler(deposerCandidature, { ...candidature, anneeId: '2025-2026' }, null);
    });

    it('convertit une candidature admissible en étudiant inscrit à toutes les UE actives', async () => {
        const { reference } = await appeler(deposerCandidature, candidature, null);
        await appeler(deciderCandidature, { id: reference, statut: 'Admissible', noteInterne: 'Dossier complet' }, admin);
        const { etudiantId } = await appeler(convertirCandidature, { id: reference, ...conversion }, admin);
        expect(await doc(`etudiants/${etudiantId}`)).toMatchObject({ email: 'awa@example.com', statut: 'Actif' });
        const [inscription] = await liste('inscriptions');
        expect(inscription).toMatchObject({ formationId: 'DGC', montantDu: 50000, ueIds: ['TEC111', 'TEC119'] });
        expect(await doc(`candidatures/${reference}`)).toMatchObject({ statut: 'Inscrite', etudiantId });
        const types = (await liste('journalEmails')).map((e) => e.type).sort();
        expect(types).toEqual(['Admission', 'Candidature', 'Inscription']);
    });

    it('refuse de convertir une candidature non admissible', async () => {
        const { reference } = await appeler(deposerCandidature, candidature, null);
        await attendreErreur(appeler(convertirCandidature, { id: reference, ...conversion }, admin), 'failed-precondition');
        expect(await liste('etudiants')).toHaveLength(0);
    });

    it('refuse de modifier une candidature déjà convertie', async () => {
        const { reference } = await appeler(deposerCandidature, candidature, null);
        await appeler(deciderCandidature, { id: reference, statut: 'Admissible' }, admin);
        await appeler(convertirCandidature, { id: reference, ...conversion }, admin);
        await attendreErreur(appeler(deciderCandidature, { id: reference, statut: 'Rejetée' }, admin), 'failed-precondition');
    });
});
