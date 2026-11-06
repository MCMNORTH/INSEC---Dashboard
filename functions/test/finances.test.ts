import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant, creerInscription, modifierInscription } from '../src/handlers/etudiants.js';
import { ajouterEcheance, ajouterVersement, modifierSituationFinanciere, traiterVersement } from '../src/handlers/finances.js';
import { genererPdf } from '../src/handlers/pdf.js';
import { tableauDeBordAdmin } from '../src/handlers/tableauDeBord.js';
import {
    coutIntecEuro, ecartAuTarif, uesEnDoublonVes, ecartEcheancier, etatEcheances, montantARembourser, montantDuSelonTarif, montantEnLettres, montantEnRetard, montantNet, nombreEnLettres,
    soldeRestant, statutPaiement,
} from '../src/shared/domaine.js';
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
        expect(email.message).toBe('Bonjour Awa, nous confirmons la bonne réception de votre paiement. Merci pour votre règlement.');
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

    it('génère la facture d’une inscription, avec logo, échéancier et versements', async () => {
        const admin = await acteur('admin');
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 100000, montantRemise: 10000 }, finance);
        await appeler(ajouterEcheance, { inscriptionId, libelle: 'Première tranche', montant: 45000, dateEcheance: '2026-10-01' }, finance);
        await appeler(ajouterVersement, { ...versement, inscriptionId }, finance);
        const facture = await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        const pdf = Buffer.from(facture.contenu, 'base64');
        expect(facture.nom).toBe('Facture-BA-Awa-2026-2027.pdf');
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        // Deux images intégrées : le logo et le cachet signé.
        expect(pdf.toString('latin1').match(/\/Subtype \/Image/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const role of ['finance', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(genererPdf, { type: 'facture', id: inscriptionId }, await acteur(role)), 'permission-denied');
        }
    });

    it('numérote les factures dans une suite continue, et garde numéro et date à la réimpression', async () => {
        const admin = await acteur('admin');
        const maintenant = new Date();
        const periode = `${maintenant.getUTCFullYear()}${String(maintenant.getUTCMonth() + 1).padStart(2, '0')}`;
        await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        const premiere = (await doc(`inscriptions/${inscriptionId}`))!;
        expect(premiere.numeroFacture).toBe(`FAC-${periode}-000001`);
        expect(premiere.factureEmiseLe).toBe(maintenant.toISOString().slice(0, 10));
        // Réimpression : même numéro, compteur inchangé.
        await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        expect((await doc(`inscriptions/${inscriptionId}`))?.numeroFacture).toBe(`FAC-${periode}-000001`);
        expect((await doc('compteurs/factures'))?.valeur).toBe(1);
        // Une autre inscription reçoit le numéro suivant.
        await appeler(creerEtudiant, etudiant('moussa@example.com'), admin);
        const autre = (await liste('inscriptions')).find((i) => i.id !== inscriptionId)!;
        await appeler(genererPdf, { type: 'facture', id: autre.id }, admin);
        expect((await doc(`inscriptions/${autre.id}`))?.numeroFacture).toBe(`FAC-${periode}-000002`);
        expect((await liste('journalAudit')).some((a) => a.modele === 'Inscription' && a.apres?.numeroFacture === `FAC-${periode}-000001`)).toBe(true);
    });

    it('écrit les montants en toutes lettres selon l’orthographe traditionnelle', () => {
        expect(nombreEnLettres(0)).toBe('zéro');
        expect(nombreEnLettres(21)).toBe('vingt et un');
        expect(nombreEnLettres(71)).toBe('soixante et onze');
        expect(nombreEnLettres(80)).toBe('quatre-vingts');
        expect(nombreEnLettres(81)).toBe('quatre-vingt-un');
        expect(nombreEnLettres(91)).toBe('quatre-vingt-onze');
        expect(nombreEnLettres(200)).toBe('deux cents');
        expect(nombreEnLettres(201)).toBe('deux cent un');
        expect(nombreEnLettres(80000)).toBe('quatre-vingt mille');
        expect(nombreEnLettres(180000)).toBe('cent quatre-vingt mille');
        expect(nombreEnLettres(200000)).toBe('deux cent mille');
        expect(nombreEnLettres(2500000)).toBe('deux millions cinq cent mille');
        expect(nombreEnLettres(200000000)).toBe('deux cents millions');
        expect(montantEnLettres(36000)).toBe('Trente-six mille ouguiyas');
        expect(montantEnLettres(1)).toBe('Un ouguiya');
    });

    it('génère le reçu d’un versement validé, avec logo et cachet, et le refuse pour un versement en attente', async () => {
        const admin = await acteur('admin');
        await appeler(modifierSituationFinanciere, { id: inscriptionId, montantDu: 100000, montantRemise: 0 }, finance);
        const { id, numeroRecu } = await appeler(ajouterVersement, { ...versement, inscriptionId }, finance);
        const recu = await appeler(genererPdf, { type: 'recu', id }, admin);
        const pdf = Buffer.from(recu.contenu, 'base64');
        expect(recu.nom).toBe(`Recu-${numeroRecu}-BA-Awa.pdf`);
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        expect(pdf.toString('latin1').match(/\/Subtype \/Image/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const role of ['finance', 'enseignant', 'etudiant'] as const) {
            await attendreErreur(appeler(genererPdf, { type: 'recu', id }, await acteur(role)), 'permission-denied');
        }
        const enAttente = await appeler(ajouterVersement, { ...versement, inscriptionId, statut: 'En attente' }, finance);
        await attendreErreur(appeler(genererPdf, { type: 'recu', id: enAttente.id }, admin), 'failed-precondition');
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

    it('calcule en euros le coût INTEC, payé sans marge par BUMEX : nombre d’UE × tarif INTEC du diplôme', () => {
        expect(coutIntecEuro('DGC', 3)).toBe(480);
        expect(coutIntecEuro('DSGC', 2)).toBe(360);
        expect(coutIntecEuro('dsgc-2026', 1)).toBe(180);
        expect(coutIntecEuro('DGC', 0)).toBe(0);
        expect(coutIntecEuro('AUTRE', 2)).toBeNull();
    });

    it('tarife les certificats de spécialisation et la validation des acquis (VES, VAPP)', () => {
        // Certificat : 280 € reversés à l'INTEC, 23 000 MRU facturés à l'étudiant.
        expect(coutIntecEuro('CS', 2)).toBe(560);
        expect(montantDuSelonTarif('CS', 2)).toBe(46000);
        expect(montantDuSelonTarif('DGC', 1)).toBe(16000);
        // VES ou VAPP : 70 € / 5 500 MRU ; VAPP + VES : 100 € / 8 000 MRU, ajoutés au prix des UE.
        expect(coutIntecEuro('DSGC', 3, 'VES')).toBe(610);
        expect(montantDuSelonTarif('DSGC', 3, 'VES')).toBe(59500);
        expect(montantDuSelonTarif('DSGC', 0, 'VAPP')).toBe(5500);
        expect(coutIntecEuro('DGC', 0, 'VAPP+VES')).toBe(100);
        expect(montantDuSelonTarif('DGC', 2, 'VAPP+VES')).toBe(40000);
        // Valeur inconnue ou absente : aucune validation facturée.
        expect(montantDuSelonTarif('DGC', 1, 'autre')).toBe(16000);
        expect(ecartAuTarif('DSGC', 3, 59500, 'VES')).toBe(0);
        expect(uesEnDoublonVes(['TEC211', 'TEC215'], ['TEC215', 'TEC217'])).toEqual(['TEC215']);
        expect(uesEnDoublonVes(['TEC211'], undefined)).toEqual([]);
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

    it('impute les versements aux échéances dans l’ordre chronologique', () => {
        const echeances = [
            { id: 'c', libelle: 'T3', montant: 30000, dateEcheance: '2026-12-01' },
            { id: 'a', libelle: 'T1', montant: 30000, dateEcheance: '2026-10-01' },
            { id: 'b', libelle: 'T2', montant: 40000, dateEcheance: '2026-11-01' },
        ];
        const etat = (totalVerse: number) =>
            etatEcheances({ montantDu: 100000, montantRemise: 0, totalVerse, echeances }, '2026-11-15').map((e) => [e.id, e.paye, e.etat]);
        expect(etat(0)).toEqual([['a', 0, 'En retard'], ['b', 0, 'En retard'], ['c', 0, 'À venir']]);
        expect(etat(50000)).toEqual([['a', 30000, 'Payée'], ['b', 20000, 'En retard'], ['c', 0, 'À venir']]);
        expect(etat(80000)).toEqual([['a', 30000, 'Payée'], ['b', 40000, 'Payée'], ['c', 10000, 'Partielle']]);
        expect(etat(120000)).toEqual([['a', 30000, 'Payée'], ['b', 40000, 'Payée'], ['c', 30000, 'Payée']]);
        // Cohérent avec le montant en retard : 20 000 restants sur T2.
        expect(montantEnRetard({ montantDu: 100000, montantRemise: 0, totalVerse: 50000, echeances }, '2026-11-15')).toBe(20000);
    });

    it('calcule le montant à rembourser : excédent sur le net, ou tout le versé si l’inscription est annulée', () => {
        const base = { montantDu: 100000, montantRemise: 10000, totalVerse: 95000, echeances: [] };
        expect(montantARembourser(base)).toBe(5000);
        expect(montantARembourser({ ...base, totalVerse: 90000 })).toBe(0);
        expect(montantARembourser({ ...base, statut: 'annulée' })).toBe(95000);
        expect(montantARembourser({ ...base, montantDu: 0, montantRemise: 0 })).toBe(0);
        expect(montantARembourser({ ...base, financeur: 'bumex' })).toBe(0);
    });

    it('signale un échéancier qui ne couvre pas tout le montant net', () => {
        const echeances = [{ id: 'a', libelle: 'T1', montant: 45000, dateEcheance: '2026-11-01' }, { id: 'b', libelle: 'T2', montant: 45000, dateEcheance: '2026-12-01' }];
        expect(ecartEcheancier({ montantDu: 100000, montantRemise: 0, totalVerse: 10000, echeances })).toBe(10000);
        expect(ecartEcheancier({ montantDu: 90000, montantRemise: 0, totalVerse: 0, echeances })).toBe(0);
        expect(ecartEcheancier({ montantDu: 100000, montantRemise: 0, totalVerse: 0, echeances: [] })).toBe(0);
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

    it('refuse un nouveau versement ou sa validation sur une inscription annulée, et signale le montant à rembourser', async () => {
        await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 10000 }, finance);
        const { id: enAttente } = await appeler(ajouterVersement, { ...versement, inscriptionId, montant: 5000, statut: 'En attente' }, finance);
        await modifier({ statut: 'annulée' });
        await attendreErreur(appeler(ajouterVersement, { ...versement, inscriptionId, montant: 1000 }, finance), 'failed-precondition');
        await attendreErreur(appeler(traiterVersement, { id: enAttente, statut: 'Validée' }, finance), 'failed-precondition');
        // Le rejet reste possible pour solder le versement en attente.
        await appeler(traiterVersement, { id: enAttente, statut: 'Rejetée', motif: 'Inscription annulée' }, finance);
        expect(montantARembourser((await doc(`inscriptions/${inscriptionId}`)) as never)).toBe(10000);
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
