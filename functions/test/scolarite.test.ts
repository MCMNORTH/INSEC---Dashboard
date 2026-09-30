import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant, creerInscription, modifierEtudiant, modifierInscription, supprimerEtudiant } from '../src/handlers/etudiants.js';
import { ajouterVersement } from '../src/handlers/finances.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const etudiantValide = {
    nom: 'Ba', prenom: 'Awa', email: 'AWA@example.com ', telephone: '', statut: 'Actif',
    formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1, dateInscription: '2026-09-20', numeroIntec: 'INTEC-1', ueIds: ['TEC111', 'TEC119'],
};

describe('Étudiants et inscriptions', () => {
    let admin: ActeurTest;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
    });

    it('crée un étudiant avec des UE compatibles et sa première inscription', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const etudiant = await doc(`etudiants/${id}`);
        expect(etudiant).toMatchObject({ email: 'awa@example.com', telephone: null, formationIds: ['DGC'], anneeIds: ['2026-2027'] });
        const inscriptions = await liste('inscriptions');
        expect(inscriptions).toHaveLength(1);
        expect(inscriptions[0]).toMatchObject({ etudiantId: id, ueIds: ['TEC111', 'TEC119'], statut: 'active', totalVerse: 0 });
        expect(etudiant?.derniere.inscriptionId).toBe(inscriptions[0].id);
        const audit = await liste('journalAudit');
        expect(audit.map((a) => a.modele).sort()).toEqual(['Etudiant', 'Inscription']);
        expect(audit[0]).toMatchObject({ acteurId: admin.uid, adresseIp: '10.0.0.1', operation: 'creerEtudiant' });
    });

    it('refuse une UE qui n’appartient pas au diplôme et à l’année choisis', async () => {
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, ueIds: ['TEC211'] }, admin), 'invalid-argument', 'ueIds');
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, ueIds: ['TEC112'] }, admin), 'invalid-argument', 'ueIds');
        expect(await liste('etudiants')).toHaveLength(0);
    });

    it('refuse un e-mail déjà utilisé', async () => {
        await appeler(creerEtudiant, etudiantValide, admin);
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, email: 'awa@example.com' }, admin), 'already-exists', 'email');
    });

    it('conserve la première inscription lors d’une réinscription', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const [premiere] = await liste('inscriptions');
        await appeler(creerInscription, { ...etudiantValide, etudiantId: id, anneeParcours: 2, ueIds: ['TEC112'] }, admin);
        const inscriptions = await liste('inscriptions');
        expect(inscriptions).toHaveLength(2);
        expect(inscriptions.find((i) => i.id === premiere.id)?.anneeParcours).toBe(1);
        const seconde = inscriptions.find((i) => i.id !== premiere.id)!;
        expect((await doc(`etudiants/${id}`))?.derniere.inscriptionId).toBe(seconde.id);
    });

    it('modifie l’identité sans toucher à l’inscription', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        await appeler(modifierEtudiant, { id, nom: 'Ba', prenom: 'Awa Marie', email: 'awa.ba@example.com', telephone: '22000000', statut: 'Actif' }, admin);
        expect(await doc(`etudiants/${id}`)).toMatchObject({ prenom: 'Awa Marie', email: 'awa.ba@example.com' });
        const [inscription] = await liste('inscriptions');
        expect(inscription).toMatchObject({ anneeParcours: 1, formationId: 'DGC' });
        // L'ancien e-mail est libéré.
        await appeler(creerEtudiant, { ...etudiantValide, nom: 'Autre' }, admin);
    });

    it('met à jour le statut d’une inscription', async () => {
        await appeler(creerEtudiant, etudiantValide, admin);
        const [inscription] = await liste('inscriptions');
        await appeler(modifierInscription, { ...etudiantValide, id: inscription.id, statut: 'suspendue' }, admin);
        expect((await doc(`inscriptions/${inscription.id}`))?.statut).toBe('suspendue');
    });

    it('interdit la suppression d’un étudiant ayant un historique financier', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const [inscription] = await liste('inscriptions');
        await appeler(ajouterVersement, { inscriptionId: inscription.id, montant: 1000, dateVersement: '2026-09-20', statut: 'En attente', modePaiement: 'Espèces' }, admin);
        await attendreErreur(appeler(supprimerEtudiant, { id }, admin), 'failed-precondition');
        expect(await doc(`etudiants/${id}`)).toBeDefined();
    });

    it('supprime un étudiant sans historique financier et ses inscriptions', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        await appeler(supprimerEtudiant, { id }, admin);
        expect(await doc(`etudiants/${id}`)).toBeUndefined();
        expect(await liste('inscriptions')).toHaveLength(0);
        expect(await liste('uniques')).toHaveLength(0);
    });
});
