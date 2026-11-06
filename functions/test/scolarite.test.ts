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

    it('facture la VES avec les UE suivies et refuse une UE à la fois suivie et dispensée (non-cumul)', async () => {
        const dsgc = { ...etudiantValide, formationId: 'DSGC', ueIds: ['TEC211', 'TEC212'], validationAcquis: 'VES', ueDispenseesIds: ['TEC215'] };
        await attendreErreur(
            appeler(creerEtudiant, { ...dsgc, ueIds: ['TEC211', 'TEC215'] }, admin),
            'invalid-argument', 'ueDispenseesIds',
        );
        await appeler(creerEtudiant, dsgc, admin);
        const [inscription] = await liste('inscriptions');
        expect(inscription).toMatchObject({ validationAcquis: 'VES', ueDispenseesIds: ['TEC215'], ueIds: ['TEC211', 'TEC212'] });
        // 2 UE DSGC (2 × 18 000) + VES (5 500) ; l'UE dispensée n'est pas facturée.
        expect(inscription.montantDu).toBe(41500);
    });

    it('inscrit aux certificats de spécialisation au tarif du certificat, et accepte une VAPP seule', async () => {
        await appeler(creerEtudiant, { ...etudiantValide, formationId: 'CS', ueIds: ['TEC712', 'TEC715'] }, admin);
        expect((await liste('inscriptions'))[0].montantDu).toBe(46000);
        await appeler(creerEtudiant, { ...etudiantValide, email: 'autre@example.com', ueIds: [], validationAcquis: 'VAPP' }, admin);
        const vapp = (await liste('inscriptions')).find((i) => i.validationAcquis === 'VAPP');
        expect(vapp?.montantDu).toBe(5500);
        // Sans UE ni validation des acquis, l'inscription est vide : refusée.
        await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, email: 'vide@example.com', ueIds: [] }, admin), 'invalid-argument', 'ueIds');
    });

    it('refuse aux rôles non autorisés d’enregistrer une validation des acquis', async () => {
        for (const role of ['finance', 'consultation'] as const) {
            const autre = await acteur(role);
            await attendreErreur(appeler(creerEtudiant, { ...etudiantValide, validationAcquis: 'VES' }, autre), 'permission-denied');
        }
        expect(await liste('inscriptions')).toHaveLength(0);
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

    it('ne supprime un étudiant avec versements que sur demande du super-administrateur, avec un motif tracé', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        const [inscription] = await liste('inscriptions');
        await appeler(ajouterVersement, { inscriptionId: inscription.id, montant: 1000, dateVersement: '2026-09-20', statut: 'Validée', modePaiement: 'Espèces' }, admin);
        await appeler(ajouterVersement, { inscriptionId: inscription.id, montant: 500, dateVersement: '2026-09-21', statut: 'En attente', modePaiement: 'Espèces' }, admin);
        const superAdmin = await acteur('super_admin');
        // Sans « forcer », la protection reste en place, même pour le super-administrateur.
        await attendreErreur(appeler(supprimerEtudiant, { id }, superAdmin), 'failed-precondition');
        // Un administrateur ne peut pas forcer ; le motif est obligatoire.
        await attendreErreur(appeler(supprimerEtudiant, { id, forcer: true, motif: 'Dossier de test' }, admin), 'permission-denied');
        await attendreErreur(appeler(supprimerEtudiant, { id, forcer: true }, superAdmin), 'invalid-argument', 'motif');
        expect(await liste('versements')).toHaveLength(2);

        const { message } = await appeler(supprimerEtudiant, { id, forcer: true, motif: 'Dossier de test' }, superAdmin);
        expect(message).toContain('2 versement(s)');
        expect(await doc(`etudiants/${id}`)).toBeUndefined();
        expect(await liste('inscriptions')).toHaveLength(0);
        expect(await liste('versements')).toHaveLength(0);
        const audit = (await liste('journalAudit')).filter((e) => e.action === 'deleted');
        expect(audit.filter((e) => e.modele === 'Versement' && e.avant?.motifSuppression === 'Dossier de test')).toHaveLength(2);
        expect(audit.some((e) => e.modele === 'Etudiant' && e.avant?.motifSuppression === 'Dossier de test')).toBe(true);
    });

    it('supprime un étudiant sans historique financier et ses inscriptions', async () => {
        const { id } = await appeler(creerEtudiant, etudiantValide, admin);
        await appeler(supprimerEtudiant, { id }, admin);
        expect(await doc(`etudiants/${id}`)).toBeUndefined();
        expect(await liste('inscriptions')).toHaveLength(0);
        expect(await liste('uniques')).toHaveLength(0);
    });
});
