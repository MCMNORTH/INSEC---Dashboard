import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { lireCoordonneesPaiement, modifierCoordonneesPaiement } from '../src/handlers/finances.js';
import { blocMoyensPaiement, genererPdf, numeroIntec } from '../src/handlers/pdf.js';
import {
    bicValide, COORDONNEES_PAIEMENT_VIDES, ibanFormate, ibanValide, numeroMobileFormate, numeroMobileValide, ribDepuisIban,
} from '../src/shared/domaine.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

// Données fictives uniquement : IBAN mauritanien valide inventé, numéros de test.
const IBAN = 'MR8500099000011234567890100';
const coordonnees = {
    titulaire: 'Société Test SA', banque: 'Banque Test', domiciliation: 'Agence Centrale NKC',
    iban: 'mr85 0009 9000 0112 3456 7890 100', bic: 'testmrmr', bankily: '22 00 00 01', sedad: '22000001',
};

describe('Moyens de paiement : règles partagées', () => {
    it('contrôle l’IBAN par sa clé et le découpe en RIB mauritanien', () => {
        expect(ibanValide(IBAN)).toBe(true);
        expect(ibanValide('MR8600099000011234567890100')).toBe(false);
        expect(ibanValide('MR85000990000112345678901')).toBe(false);
        expect(ibanFormate(IBAN)).toBe('MR85 0009 9000 0112 3456 7890 100');
        expect(ribDepuisIban(IBAN)).toEqual({ banque: '00099', agence: '00001', compte: '12345678901', cle: '00' });
        expect(ribDepuisIban('FR7630006000011234567890189')).toBeNull();
    });

    it('vérifie les numéros Bankily / Sedad et le code SWIFT', () => {
        expect(numeroMobileValide('22 00 00 01')).toBe(true);
        expect(numeroMobileValide('12000001')).toBe(false);
        expect(numeroMobileValide('2200000')).toBe(false);
        expect(numeroMobileFormate('22000001')).toBe('22 00 00 01');
        expect(bicValide('TESTMRMR')).toBe(true);
        expect(bicValide('TESTMR')).toBe(false);
    });

    it('imprime virement, mobile, espèces et le motif ; un numéro commun n’apparaît qu’une fois', () => {
        const bloc = JSON.stringify(blocMoyensPaiement({ ...coordonnees, iban: IBAN, bic: 'TESTMRMR', bankily: '22000001', sedad: '22000001' }, 'FAC-202611-000001', 'BA Awa'));
        for (const texte of ['MOYENS DE PAIEMENT', 'VIREMENT BANCAIRE', 'Société Test SA', 'Banque Test · Agence Centrale NKC', '00099 00001 12345678901 00',
            'MR85 0009 9000 0112 3456 7890 100', 'TESTMRMR', 'Bankily · Sedad', 'ESPÈCES', 'FAC-202611-000001 · BA Awa']) {
            expect(bloc).toContain(texte);
        }
        expect(bloc.match(/22 00 00 01/g)).toHaveLength(1);
        // Sans coordonnées : seules les espèces au secrétariat.
        const minimal = JSON.stringify(blocMoyensPaiement(COORDONNEES_PAIEMENT_VIDES, 'FAC-1', 'BA Awa'));
        expect(minimal).toContain('ESPÈCES');
        expect(minimal).not.toContain('VIREMENT');
        expect(minimal).not.toContain('PAIEMENT MOBILE');
        // Numéros différents : deux lignes distinctes.
        const deux = JSON.stringify(blocMoyensPaiement({ ...COORDONNEES_PAIEMENT_VIDES, bankily: '22000001', sedad: '33000002' }, 'FAC-1', 'BA Awa'));
        expect(deux).toContain('"Bankily"');
        expect(deux).toContain('"Sedad"');
    });

    it('n’imprime le N° INTEC que s’il est connu', () => {
        expect(numeroIntec({ numeroIntec: 'INT-001' })).toBe('INT-001');
        expect(numeroIntec({})).toBeNull();
        expect(numeroIntec({ numeroIntec: null })).toBeNull();
        expect(numeroIntec({ numeroIntec: '   ' })).toBeNull();
    });
});

describe('Moyens de paiement : réglage', () => {
    let superAdmin: ActeurTest;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        superAdmin = await acteur('super_admin');
    });

    it('enregistre les coordonnées (normalisées), les relit et journalise la modification', async () => {
        expect((await appeler(lireCoordonneesPaiement, {}, superAdmin)).coordonnees).toEqual(COORDONNEES_PAIEMENT_VIDES);
        await appeler(modifierCoordonneesPaiement, coordonnees, superAdmin);
        const { coordonnees: lues, modifieLe } = await appeler(lireCoordonneesPaiement, {}, await acteur('finance'));
        expect(lues).toEqual({ ...coordonnees, iban: IBAN, bic: 'TESTMRMR', bankily: '22000001', sedad: '22000001' });
        expect(modifieLe).toEqual(expect.any(String));
        expect((await doc('parametres/coordonneesPaiement'))?.modifiePar).toBe(superAdmin.uid);
        expect((await liste('journalAudit')).some((a) => a.modele === 'Paramètre financier' && a.apres?.iban === IBAN)).toBe(true);
    });

    it('refuse un IBAN faux, un numéro mobile invalide ou un IBAN sans titulaire', async () => {
        await attendreErreur(appeler(modifierCoordonneesPaiement, { ...coordonnees, iban: 'MR8600099000011234567890100' }, superAdmin), 'invalid-argument', 'iban');
        await attendreErreur(appeler(modifierCoordonneesPaiement, { ...coordonnees, bankily: '1234' }, superAdmin), 'invalid-argument', 'bankily');
        await attendreErreur(appeler(modifierCoordonneesPaiement, { ...coordonnees, titulaire: '' }, superAdmin), 'invalid-argument', 'titulaire');
        expect(await doc('parametres/coordonneesPaiement')).toBeFalsy();
    });

    it('réserve la modification au super-administrateur', async () => {
        for (const role of ['admin', 'admin_lecture', 'finance', 'consultation', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(modifierCoordonneesPaiement, coordonnees, await acteur(role)), 'permission-denied');
        }
        for (const role of ['enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(lireCoordonneesPaiement, {}, await acteur(role)), 'permission-denied');
        }
    });

    it('génère toujours la facture, avec ou sans coordonnées enregistrées', async () => {
        const admin = await acteur('admin');
        await appeler(creerEtudiant, {
            nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1,
            dateInscription: '2026-09-20', ueIds: ['TEC111'],
        }, admin);
        const inscriptionId = (await liste('inscriptions'))[0].id;
        const sans = await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        await appeler(modifierCoordonneesPaiement, coordonnees, superAdmin);
        const avec = await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        expect(Buffer.from(avec.contenu, 'base64').subarray(0, 4).toString()).toBe('%PDF');
        expect(avec.contenu.length).toBeGreaterThan(sans.contenu.length);
    });
});
