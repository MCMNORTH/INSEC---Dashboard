import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant, modifierInscription } from '../src/handlers/etudiants.js';
import { creerExamen, enregistrerResultat, modifierExamen, publierResultatsExamen } from '../src/handlers/examens.js';
import { genererPdf } from '../src/handlers/pdf.js';
import { db } from '../src/lib/firebase.js';
import { horaireExamen } from '../src/shared/domaine.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const examen = {
    ueId: 'TEC111', anneeId: '2026-2027', session: 'Normale', dateExamen: '2099-01-15T09:00:00+00:00', salle: 'A1',
    noteSur: 20, seuilValidation: 10, statut: 'Planifié',
};
const etudiant = (email: string, ueIds: string[], anneeId = '2026-2027') => ({
    nom: 'Ba', prenom: 'Awa', email, statut: 'Actif', formationId: 'DGC', anneeId, anneeParcours: 1, dateInscription: '2026-09-20', ueIds,
});

describe('Examens et résultats', () => {
    let admin: ActeurTest;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
    });

    it('ouvre le suivi pour les seuls étudiants éligibles sans envoyer de convocation', async () => {
        const { id: eligible } = await appeler(creerEtudiant, etudiant('eligible@example.com', ['TEC111']), admin);
        await appeler(creerEtudiant, etudiant('autre-ue@example.com', ['TEC119']), admin);
        await appeler(creerEtudiant, etudiant('autre-annee@example.com', ['TEC111'], '2025-2026'), admin);
        const { id } = await appeler(creerExamen, examen, admin);
        const resultats = await liste('resultats');
        expect(resultats).toHaveLength(1);
        expect(resultats[0]).toMatchObject({ examenId: id, etudiantId: eligible, presence: 'Convoqué', numeroConvocation: 1 });
        expect((await doc(`examens/${id}`))?.nbConvoques).toBe(1);
        const emails = await liste('journalEmails');
        expect(emails).toHaveLength(0);
    });

    it('valide l’UE lorsque la note atteint le seuil et génère les documents', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 12, commentaire: 'Admis' }, admin);
        expect(await doc(`resultats/${resultat.id}`)).toMatchObject({ note: 12, valide: true, resultatPublie: false });

        const releve = await appeler(genererPdf, { type: 'releve', id: resultat.inscriptionId }, admin);
        const pdf = Buffer.from(releve.contenu, 'base64');
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        const convocation = await appeler(genererPdf, { type: 'convocation', id: resultat.id }, admin);
        expect(convocation.nom).toBe('convocation-examen-CONV-000001.pdf');
    });

    it('n’envoie une note qu’à la publication des résultats, une seule fois, puis à nouveau si elle est corrigée', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        const { id } = await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 8 }, admin);
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 18 }, admin);
        expect((await liste('journalEmails')).filter((e) => e.type === 'Résultat')).toHaveLength(0);

        expect(await appeler(publierResultatsExamen, { id }, admin)).toMatchObject({ publies: 1, sansEmail: 0 });
        let emails = (await liste('journalEmails')).filter((e) => e.type === 'Résultat');
        expect(emails).toHaveLength(1);
        expect(emails[0].details).toMatchObject({ Note: '18/20', Décision: 'Validée' });
        expect(await doc(`resultats/${resultat.id}`)).toMatchObject({ resultatPublie: true });

        // Une seconde publication n'envoie rien ; une correction redevient à publier.
        expect(await appeler(publierResultatsExamen, { id }, admin)).toMatchObject({ publies: 0 });
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 17 }, admin);
        await appeler(publierResultatsExamen, { id }, admin);
        emails = (await liste('journalEmails')).filter((e) => e.type === 'Résultat');
        expect(emails).toHaveLength(2);

        for (const role of ['finance', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(publierResultatsExamen, { id }, await acteur(role)), 'permission-denied');
        }
    });

    it('publie sans e-mail pour un étudiant sans adresse valide', async () => {
        await appeler(creerEtudiant, { ...etudiant('', ['TEC111']), email: null }, admin);
        const { id } = await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 9 }, admin);
        expect(await appeler(publierResultatsExamen, { id }, admin)).toMatchObject({ publies: 1, sansEmail: 1 });
        expect(await liste('journalEmails')).toHaveLength(0);
    });

    it('modifie la date et la salle, recopie sur les convocations et permet de renvoyer celles déjà envoyées', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        const { id } = await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await db.collection('resultats').doc(resultat.id).update({ convocationEnvoiStatut: 'Envoyée' });
        const reponse = await appeler(modifierExamen, { id, dateExamen: '2099-01-20T13:00:00+00:00', salle: 'B2', statut: 'Planifié' }, admin);
        expect(reponse.aRenvoyer).toBe(1);
        expect(await doc(`examens/${id}`)).toMatchObject({ salle: 'B2', statut: 'Planifié' });
        const apres = (await doc(`resultats/${resultat.id}`))!;
        expect(apres).toMatchObject({ salle: 'B2', statutExamen: 'Planifié', convocationEnvoiStatut: null });
        expect(apres.dateExamen.toDate().toISOString()).toBe('2099-01-20T13:00:00.000Z');
        await attendreErreur(appeler(modifierExamen, { id, dateExamen: '2099-01-20T13:00:00+00:00', salle: 'B2', statut: 'Planifié' }, await acteur('finance')), 'permission-denied');
    });

    it('annule un examen sans note, mais refuse d’annuler un examen déjà noté', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        const { id } = await appeler(creerExamen, examen, admin);
        await appeler(modifierExamen, { id, dateExamen: examen.dateExamen, salle: 'A1', statut: 'Annulé' }, admin);
        expect((await liste('resultats'))[0].statutExamen).toBe('Annulé');
        await attendreErreur(appeler(publierResultatsExamen, { id }, admin), 'failed-precondition');

        await appeler(modifierExamen, { id, dateExamen: examen.dateExamen, salle: 'A1', statut: 'Planifié' }, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 11 }, admin);
        await attendreErreur(appeler(modifierExamen, { id, dateExamen: examen.dateExamen, salle: 'A1', statut: 'Annulé' }, admin), 'invalid-argument', 'statut');
    });

    it('refuse une note supérieure au maximum et une présence sans note', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await attendreErreur(appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 21 }, admin), 'invalid-argument', 'note');
        await attendreErreur(appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: '' }, admin), 'invalid-argument', 'note');
    });

    it('efface la note d’un étudiant absent', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Absent', note: 15 }, admin);
        expect(await doc(`resultats/${resultat.id}`)).toMatchObject({ note: null, valide: false });
    });

    it('refuse un seuil de validation supérieur à la note maximale', async () => {
        await attendreErreur(appeler(creerExamen, { ...examen, seuilValidation: 25 }, admin), 'invalid-argument', 'seuilValidation');
    });
});

describe('Convocations : fuseaux horaires et inscriptions non actives', () => {
    let admin: ActeurTest;
    const modifier = async (inscriptionId: string, modifications: Record<string, unknown>) => {
        const i = (await doc(`inscriptions/${inscriptionId}`))!;
        return appeler(modifierInscription, {
            id: inscriptionId, formationId: i.formationId, anneeId: i.anneeId, anneeParcours: i.anneeParcours,
            dateInscription: i.dateInscription, numeroIntec: i.numeroIntec ?? null, ueIds: i.ueIds, financeur: i.financeur,
            statut: i.statut, ...modifications,
        }, admin);
    };
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
    });

    it('affiche l’heure de Paris et celle de Nouakchott, en hiver comme en été', () => {
        expect(horaireExamen(new Date('2027-01-15T08:00:00Z'))).toBe('15/01/2027 à 09:00 (heure de Paris) · 08:00 (heure de Nouakchott)');
        expect(horaireExamen(new Date('2027-05-03T07:00:00Z'))).toBe('03/05/2027 à 09:00 (heure de Paris) · 07:00 (heure de Nouakchott)');
        expect(horaireExamen(new Date('2026-12-31T23:30:00Z'))).toBe('01/01/2027 à 00:30 (heure de Paris) · 31/12/2026 à 23:30 (heure de Nouakchott)');
    });

    it('ne convoque pas une inscription annulée', async () => {
        const { id: convoque } = await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        const { id: annule } = await appeler(creerEtudiant, etudiant('annule@example.com', ['TEC111']), admin);
        const inscriptionAnnulee = (await liste('inscriptions')).find((i) => i.etudiantId === annule)!;
        await modifier(inscriptionAnnulee.id, { statut: 'annulée' });

        const { id } = await appeler(creerExamen, examen, admin);
        const resultats = await liste('resultats');
        expect(resultats.map((r) => r.etudiantId)).toEqual([convoque]);
        expect((await doc(`examens/${id}`))?.nbConvoques).toBe(1);
        const [resultat] = resultats;
        const convocation = await appeler(genererPdf, { type: 'convocation', id: resultat.id }, admin);
        expect(Buffer.from(convocation.contenu, 'base64').subarray(0, 4).toString()).toBe('%PDF');
    });

    it('retire la convocation en attente quand l’inscription est annulée ou que l’UE est retirée', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111', 'TEC119']), admin);
        const [inscription] = await liste('inscriptions');
        const { id: examen111 } = await appeler(creerExamen, examen, admin);
        const { id: examen119 } = await appeler(creerExamen, { ...examen, ueId: 'TEC119' }, admin);
        expect(await liste('resultats')).toHaveLength(2);

        await modifier(inscription.id, { ueIds: ['TEC111'] });
        expect((await liste('resultats')).map((r) => r.examenId)).toEqual([examen111]);
        expect((await doc(`examens/${examen119}`))?.nbConvoques).toBe(0);

        await modifier(inscription.id, { statut: 'annulée' });
        expect(await liste('resultats')).toHaveLength(0);
        expect((await doc(`examens/${examen111}`))?.nbConvoques).toBe(0);
    });

    it('refuse l’ouverture d’une épreuve aux rôles non administrateurs', async () => {
        for (const role of ['finance', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(creerExamen, examen, await acteur(role)), 'permission-denied');
        }
    });
});
