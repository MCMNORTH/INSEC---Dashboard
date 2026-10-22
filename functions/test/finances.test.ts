import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant, creerInscription, modifierInscription } from '../src/handlers/etudiants.js';
import { ajouterEcheance, ajouterVersement, modifierSituationFinanciere } from '../src/handlers/finances.js';
import { tableauDeBordAdmin } from '../src/handlers/tableauDeBord.js';
import { ecartAuTarif, montantDuSelonTarif, montantEnRetard, montantNet, soldeRestant, statutPaiement } from '../src/shared/domaine.js';
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

describe('Montant dû au tarif et dossiers non recouvrables', () => {
    let admin: ActeurTest;
    let finance: ActeurTest;
    let inscriptionId: string;
    const champsInscription = (id: string, inscription: Record<string, any>, modifications: Record<string, unknown> = {}) => ({
        id, formationId: inscription.formationId, anneeId: inscription.anneeId, anneeParcours: inscription.anneeParcours,
        dateInscription: inscription.dateInscription, numeroIntec: inscription.numeroIntec ?? null, ueIds: inscription.ueIds,
        financeur: inscription.financeur, statut: inscription.statut, ...modifications,
    });
    const modifier = async (modifications: Record<string, unknown>, qui: ActeurTest = admin) => {
        const inscription = (await doc(`inscriptions/${inscriptionId}`))!;
        return appeler(modifierInscription, champsInscription(inscriptionId, inscription, modifications), qui);
    };
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
        finance = await acteur('finance');
        await appeler(creerEtudiant, { ...etudiant('awa@example.com'), ueIds: ['TEC111', 'TEC119'] }, admin);
        inscriptionId = (await liste('inscriptions'))[0].id;
    });

    it('calcule le montant dû d’une nouvelle inscription : nombre d’UE × tarif du diplôme', async () => {
        const inscription = (await doc(`inscriptions/${inscriptionId}`)) as never;
        expect(montantDuSelonTarif('DGC', 2)).toBe(32000);
        expect((inscription as { montantDu: number }).montantDu).toBe(32000);
        expect(statutPaiement(inscription)).toBe('Impayé');

        const [{ etudiantId }] = await liste('inscriptions');
        await appeler(creerInscription, { etudiantId, formationId: 'DSGC', anneeId: '2026-2027', anneeParcours: 1, ueIds: ['TEC211'] }, admin);
        const dsgc = (await liste('inscriptions')).find((i) => i.formationId === 'DSGC')!;
        expect(dsgc.montantDu).toBe(18000);
    });

    it('mesure l’écart entre le montant dû saisi et le tarif (UE × tarif)', () => {
        expect(ecartAuTarif('DGC', 2, 32000)).toBe(0);
        expect(ecartAuTarif('DGC', 2, 40000)).toBe(8000);
        expect(ecartAuTarif('DSGC', 3, 50000)).toBe(-4000);
        expect(ecartAuTarif('DGC', 1, 0)).toBe(-16000);
        expect(ecartAuTarif('LICENCE', 2, 30000)).toBeNull();
    });

    it('ne présente jamais un dossier sans montant comme soldé', () => {
        expect(statutPaiement({ montantDu: 0, montantRemise: 0, totalVerse: 0, echeances: [] })).toBe('À chiffrer');
        expect(statutPaiement({ montantDu: 16000, montantRemise: 16000, totalVerse: 0, echeances: [] })).toBe('Soldé');
    });

    it('recalcule le montant quand les UE changent, sauf montant fixé à la main', async () => {
        await modifier({ ueIds: ['TEC111'] });
        expect((await doc(`inscriptions/${inscriptionId}`))?.montantDu).toBe(16000);

        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 12000, montantRemise: 0 }, finance);
        await modifier({ ueIds: ['TEC111', 'TEC119'] });
        expect((await doc(`inscriptions/${inscriptionId}`))?.montantDu).toBe(12000);
    });

    it('exclut une inscription annulée du reste à recouvrer et du tableau de bord', async () => {
        await modifier({ statut: 'annulée' });
        const inscription = (await doc(`inscriptions/${inscriptionId}`)) as never;
        expect(soldeRestant(inscription)).toBe(0);
        expect(statutPaiement(inscription)).toBe('Annulée');
        const tableau = await appeler(tableauDeBordAdmin, { anneeId: '2026-2027' }, admin);
        expect(tableau).toMatchObject({ montantFacture: 0, resteARecouvrer: 0 });
        expect(tableau.impayes).toHaveLength(0);
    });

    it('ne compte pas un dossier BUMEX comme une dette de l’étudiant', async () => {
        await modifier({ financeur: 'bumex' });
        const inscription = (await doc(`inscriptions/${inscriptionId}`)) as never;
        expect(soldeRestant(inscription)).toBe(0);
        expect(montantEnRetard({ ...(inscription as object), echeances: [{ id: 'e', libelle: 'T1', montant: 1000, dateEcheance: '2000-01-01' }] } as never)).toBe(0);
        expect(statutPaiement(inscription)).toBe('Pris en charge BUMEX');
    });

    it('refuse de changer le financeur d’une inscription qui a déjà des versements', async () => {
        await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 10000 }, finance);
        await attendreErreur(modifier({ financeur: 'bumex' }), 'invalid-argument', 'financeur');
    });

    it('refuse la modification d’une inscription et de sa situation financière aux rôles non autorisés', async () => {
        for (const role of ['enseignant', 'etudiant'] as const) {
            await attendreErreur(modifier({ ueIds: ['TEC111'] }, await acteur(role)), 'permission-denied');
            await attendreErreur(appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 1000, montantRemise: 0 }, await acteur(role)), 'permission-denied');
        }
        await attendreErreur(modifier({ ueIds: ['TEC111'] }, finance), 'permission-denied');
    });
});
