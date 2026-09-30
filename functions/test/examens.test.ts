import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { creerExamen, enregistrerResultat } from '../src/handlers/examens.js';
import { genererPdf } from '../src/handlers/pdf.js';
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

    it('convoque automatiquement les seuls étudiants éligibles', async () => {
        const { id: eligible } = await appeler(creerEtudiant, etudiant('eligible@example.com', ['TEC111']), admin);
        await appeler(creerEtudiant, etudiant('autre-ue@example.com', ['TEC119']), admin);
        await appeler(creerEtudiant, etudiant('autre-annee@example.com', ['TEC111'], '2025-2026'), admin);
        const { id } = await appeler(creerExamen, examen, admin);
        const resultats = await liste('resultats');
        expect(resultats).toHaveLength(1);
        expect(resultats[0]).toMatchObject({ examenId: id, etudiantId: eligible, presence: 'Convoqué', numeroConvocation: 1 });
        expect((await doc(`examens/${id}`))?.nbConvoques).toBe(1);
        const emails = await liste('journalEmails');
        expect(emails).toHaveLength(1);
        expect(emails[0]).toMatchObject({ destinataire: 'eligible@example.com', type: 'Convocation' });
    });

    it('valide l’UE lorsque la note atteint le seuil et génère les documents', async () => {
        await appeler(creerEtudiant, etudiant('awa@example.com', ['TEC111']), admin);
        await appeler(creerExamen, examen, admin);
        const [resultat] = await liste('resultats');
        await appeler(enregistrerResultat, { id: resultat.id, presence: 'Présent', note: 12, commentaire: 'Admis' }, admin);
        expect(await doc(`resultats/${resultat.id}`)).toMatchObject({ note: 12, valide: true });
        const emails = await liste('journalEmails');
        expect(emails.some((e) => e.type === 'Résultat' && e.lien === '/portail/etudiant')).toBe(true);

        const releve = await appeler(genererPdf, { type: 'releve', id: resultat.inscriptionId }, admin);
        const pdf = Buffer.from(releve.contenu, 'base64');
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        const convocation = await appeler(genererPdf, { type: 'convocation', id: resultat.id }, admin);
        expect(convocation.nom).toBe('convocation-examen-CONV-000001.pdf');
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
