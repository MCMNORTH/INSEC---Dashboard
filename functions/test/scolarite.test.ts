import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant, creerInscription, modifierEtudiant, modifierInscription, supprimerEtudiant } from '../src/handlers/etudiants.js';
import { creerExamen, enregistrerPresencesExamen } from '../src/handlers/examens.js';
import { ajouterVersement } from '../src/handlers/finances.js';
import { montantDuSelonTarif } from '../src/shared/domaine.js';
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

    it('refuse une UE d’un autre diplôme et une année de parcours au-delà de la durée du diplôme', async () => {
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, ueIds: ['TEC211'] }, admin), 'invalid-argument', 'ueIds');
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, anneeParcours: 4, ueIds: ['TEC111'] }, admin), 'invalid-argument', 'anneeParcours');
        expect(await liste('etudiants')).toHaveLength(0);
    });

    it('accepte des UE de plusieurs années du même diplôme dans une inscription, au tarif du nombre d’UE', async () => {
        await appeler(creerEtudiant, { ...etudiantValide, anneeParcours: 1, ueIds: ['TEC111', 'TEC119', 'TEC112'] }, admin);
        const [inscription] = await liste('inscriptions');
        expect(inscription).toMatchObject({ anneeParcours: 1, ueIds: ['TEC111', 'TEC119', 'TEC112'] });
        expect(inscription.montantDu).toBe(montantDuSelonTarif('DGC', 3));
    });

    it('refuse un e-mail déjà utilisé', async () => {
        await appeler(creerEtudiant, etudiantValide, admin);
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, email: 'awa@example.com' }, admin), 'already-exists', 'email');
    });

    it('conserve la première inscription et ajoute celle d’une nouvelle année scolaire', async () => {
        const { id } = await appeler(creerEtudiant, { ...etudiantValide, anneeId: '2025-2026' }, admin);
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

    it('accepte une modification d’inscription dont les valeurs lues n’ont pas changé, même après un versement', async () => {
        await appeler(creerEtudiant, etudiantValide, admin);
        const [i] = await liste('inscriptions');
        // Valeurs telles que le formulaire les lit à l'ouverture (champs absents = null).
        const attendu = {
            formationId: i.formationId, anneeId: i.anneeId, anneeParcours: i.anneeParcours, dateInscription: i.dateInscription,
            numeroIntec: i.numeroIntec ?? null, statut: i.statut, financeur: i.financeur ?? null, ueIds: [...i.ueIds].reverse(),
        };
        await appeler(ajouterVersement, { inscriptionId: i.id, montant: 1000, dateVersement: '2026-09-20', statut: 'Validée', modePaiement: 'Espèces' }, admin);
        await appeler(modifierInscription, { ...etudiantValide, id: i.id, statut: 'suspendue', attendu }, admin);
        await attendreErreur(appeler(modifierInscription, { ...etudiantValide, id: i.id, statut: 'terminée', attendu }, admin), 'failed-precondition');
        expect((await doc(`inscriptions/${i.id}`))?.statut).toBe('suspendue');
    });

    it('refuse une modification d’identité si une autre personne l’a changée entre-temps', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const lu = (await doc(`etudiants/${id}`))!;
        const attendu = { nom: lu.nom, prenom: lu.prenom, email: lu.email, dateNaissance: lu.dateNaissance ?? null, telephone: lu.telephone ?? null, statut: lu.statut };
        const identite = { nom: lu.nom, prenom: lu.prenom, email: lu.email, telephone: '', statut: 'Actif' };
        await appeler(modifierEtudiant, { id, ...identite, nom: 'Ba-Diop', attendu }, admin);
        await attendreErreur(appeler(modifierEtudiant, { id, ...identite, prenom: 'Aïcha', attendu }, admin), 'failed-precondition');
        expect(await doc(`etudiants/${id}`)).toMatchObject({ nom: 'Ba-Diop', prenom: 'Awa' });
    });

    it('interdit la suppression d’un étudiant ayant un historique financier', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const [inscription] = await liste('inscriptions');
        await appeler(ajouterVersement, { inscriptionId: inscription.id, montant: 1000, dateVersement: '2026-09-20', statut: 'En attente', modePaiement: 'Espèces' }, admin);
        await attendreErreur(appeler(supprimerEtudiant, { id }, admin), 'failed-precondition');
        expect(await doc(`etudiants/${id}`)).toBeDefined();
    });

    it('interdit la suppression d’un étudiant ayant un historique d’examen', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const { id: examenId } = await appeler(creerExamen, {
            ueId: 'TEC111', anneeId: '2026-2027', session: 'Normale', dateExamen: '2099-01-15T09:00:00+00:00', salle: 'A1',
            noteSur: 20, seuilValidation: 10, statut: 'Planifié',
        }, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerPresencesExamen, { id: examenId, presences: [{ resultatId: resultat.id, presence: 'Absent' }] }, admin);
        await attendreErreur(appeler(supprimerEtudiant, { id }, admin), 'failed-precondition');
        expect(await doc(`etudiants/${id}`)).toBeDefined();
        expect(await liste('resultats')).toHaveLength(1);
    });

    it('supprime un étudiant sans historique financier et ses inscriptions', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        await appeler(supprimerEtudiant, { id }, admin);
        expect(await doc(`etudiants/${id}`)).toBeUndefined();
        expect(await liste('inscriptions')).toHaveLength(0);
        expect(await liste('uniques')).toHaveLength(0);
    });
});
