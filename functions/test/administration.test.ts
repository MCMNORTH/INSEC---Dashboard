import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it } from 'vitest';
import { synchroniserAlertes } from '../src/handlers/alertes.js';
import { basculerCompte, creerCompte } from '../src/handlers/comptes.js';
import { enregistrerPiece, modifierPiece, telechargerPiece } from '../src/handlers/documents.js';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { exporterExcel, importerEtudiants } from '../src/handlers/excel.js';
import { ajouterEcheance, modifierSituationFinanciere } from '../src/handlers/finances.js';
import { verifierDisponibilite } from '../src/handlers/sante.js';
import { restaurerSauvegarde } from '../src/handlers/sauvegardes.js';
import { tableauDeBordAdmin } from '../src/handlers/tableauDeBord.js';
import { expedier, rendreEmail } from '../src/lib/email.js';
import { auth, bucket, db } from '../src/lib/firebase.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const etudiant = {
    nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027',
    anneeParcours: 1, dateInscription: '2026-09-20', ueIds: ['TEC111'],
};

async function classeurBase64(lignes: (string | number)[][]): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const feuille = wb.addWorksheet('Import');
    lignes.forEach((l) => feuille.addRow(l));
    return Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
}

describe('Administration', () => {
    let admin: ActeurTest;
    let etudiantId: string;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
        ({ id: etudiantId } = await appeler(creerEtudiant, etudiant, admin));
    });

    describe('Comptes', () => {
        it('crée un compte étudiant avec ses droits et refuse un second compte sur le même dossier', async () => {
            const { uid } = await appeler(creerCompte, { nom: 'Awa Ba', email: 'awa.compte@example.com', motDePasse: 'motdepasse-solide', role: 'etudiant', etudiantId }, admin);
            const utilisateur = await auth.getUser(uid);
            expect(utilisateur.customClaims).toEqual({ role: 'etudiant', etudiantId });
            expect(await doc(`utilisateurs/${uid}`)).toMatchObject({ role: 'etudiant', etudiantId, actif: true });
            const audit = (await liste('journalAudit')).find((a) => a.modele === 'User')!;
            expect(JSON.stringify(audit)).not.toContain('motdepasse-solide');
            await attendreErreur(
                appeler(creerCompte, { nom: 'Doublon', email: 'autre@example.com', motDePasse: 'motdepasse-solide', role: 'etudiant', etudiantId }, admin),
                'invalid-argument', 'etudiantId',
            );
        });

        it('exige un dossier pour les rôles étudiant et enseignant', async () => {
            await attendreErreur(appeler(creerCompte, { nom: 'X', email: 'x@example.com', motDePasse: 'motdepasse-solide', role: 'enseignant' }, admin), 'invalid-argument', 'enseignantId');
        });

        it('désactive un compte, qui perd immédiatement l’accès, mais pas le sien', async () => {
            const { uid } = await appeler(creerCompte, { nom: 'Finance', email: 'finance@example.com', motDePasse: 'motdepasse-solide', role: 'finance' }, admin);
            await appeler(basculerCompte, { uid }, admin);
            expect((await auth.getUser(uid)).disabled).toBe(true);
            await attendreErreur(appeler(ajouterEcheance, { inscriptionId: 'x', libelle: 'T', montant: 1, dateEcheance: '2026-01-01' }, { uid, role: 'finance' }), 'permission-denied');
            await attendreErreur(appeler(basculerCompte, { uid: admin.uid }, admin), 'failed-precondition');
        });
    });

    describe('Pièces administratives', () => {
        it('enregistre une pièce téléversée, journalise son téléchargement et met à jour son statut', async () => {
            const chemin = `dossiers/${etudiantId}/abc-identite.pdf`;
            await bucket().file(chemin).save(Buffer.from('%PDF-1.4 test'), { contentType: 'application/pdf' });
            const { id } = await appeler(enregistrerPiece, { etudiantId, chemin, nomOriginal: 'identite.pdf', type: 'Pièce d’identité' }, admin);
            expect(await doc(`pieces/${id}`)).toMatchObject({ statut: 'À vérifier', mimeType: 'application/pdf', taille: 13 });
            const fichier = await appeler(telechargerPiece, { id }, admin);
            expect(Buffer.from(fichier.contenu, 'base64').toString()).toBe('%PDF-1.4 test');
            expect((await liste('journalAudit')).some((a) => a.action === 'download' && a.modeleId === id)).toBe(true);
            await appeler(modifierPiece, { id, statut: 'Rejeté', note: 'Illisible' }, admin);
            expect(await doc(`pieces/${id}`)).toMatchObject({ statut: 'Rejeté', note: 'Illisible' });
        });

        it('refuse un fichier hors du dossier de l’étudiant ou d’un type non autorisé', async () => {
            await attendreErreur(appeler(enregistrerPiece, { etudiantId, chemin: 'dossiers/autre/x.pdf', nomOriginal: 'x.pdf', type: 'Autre' }, admin), 'invalid-argument', 'fichier');
            const chemin = `dossiers/${etudiantId}/script.html`;
            await bucket().file(chemin).save('<script>', { contentType: 'text/html' });
            await attendreErreur(appeler(enregistrerPiece, { etudiantId, chemin, nomOriginal: 'script.html', type: 'Autre' }, admin), 'invalid-argument', 'fichier');
            expect((await bucket().file(chemin).exists())[0]).toBe(false);
        });
    });

    describe('Excel', () => {
        it('exporte les étudiants et journalise l’export', async () => {
            const fichier = await appeler(exporterExcel, { type: 'etudiants' }, admin);
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(Buffer.from(fichier.contenu, 'base64') as never);
            const feuille = wb.worksheets[0];
            expect(feuille.getRow(1).getCell(2).text).toBe('Prénom');
            expect(feuille.getRow(2).getCell(4).text).toBe('awa@example.com');
            expect(feuille.getRow(2).getCell(7).text).toBe('DGC');
            expect((await liste('journalAudit')).some((a) => a.action === 'export')).toBe(true);
            for (const type of ['modele', 'finances', 'resultats']) await appeler(exporterExcel, { type }, admin);
        });

        it('importe les lignes valides, ignore ou met à jour les doublons et signale les erreurs', async () => {
            const contenu = await classeurBase64([
                ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Statut'],
                ['Moussa', 'Diallo', 'moussa@example.com', 22000000, 'Actif'],
                ['Awa', 'Ba-Modifiée', 'AWA@example.com', '', 'Actif'],
                ['', '', 'invalide', '', 'Inconnu'],
            ]);
            const ignorer = await appeler(importerEtudiants, { nom: 'import.xlsx', contenu, mode: 'ignorer' }, admin);
            expect(ignorer).toMatchObject({ crees: 1, misAJour: 0, ignores: 1 });
            expect(ignorer.erreurs).toHaveLength(1);
            expect(ignorer.erreurs[0]).toMatch(/^Ligne 4/);
            const maj = await appeler(importerEtudiants, { nom: 'import.xlsx', contenu, mode: 'mettre_a_jour' }, admin);
            expect(maj).toMatchObject({ crees: 0, misAJour: 2 });
            expect((await doc(`etudiants/${etudiantId}`))?.nom).toBe('Ba-Modifiée');
            expect((await liste('etudiants')).find((e) => e.email === 'moussa@example.com')?.telephone).toBe('22000000');
        });

        it('refuse un fichier dont les colonnes ne suivent pas le modèle', async () => {
            const contenu = await classeurBase64([['Nom', 'Prénom']]);
            await attendreErreur(appeler(importerEtudiants, { nom: 'x.xlsx', contenu, mode: 'ignorer' }, admin), 'failed-precondition');
        });
    });

    describe('Alertes et tableau de bord', () => {
        it('produit les alertes de retard pour la finance et l’étudiant concerné, sans les dupliquer', async () => {
            const [inscription] = await liste('inscriptions');
            const finance = await acteur('finance');
            await appeler(modifierSituationFinanciere, { id: inscription.id, montantDu: 100000, montantRemise: 0 }, finance);
            await appeler(ajouterEcheance, { inscriptionId: inscription.id, libelle: 'T1', montant: 40000, dateEcheance: '2025-01-01' }, finance);

            expect(await appeler(synchroniserAlertes, {}, finance)).toEqual({ total: 1 });
            await appeler(synchroniserAlertes, {}, finance);
            const alertes = (await db.collection(`utilisateurs/${finance.uid}/alertes`).get()).docs.map((d) => d.data());
            expect(alertes).toHaveLength(1);
            expect(alertes[0]).toMatchObject({ titre: 'Paiement en retard', niveau: 'danger', active: true, lueLe: null });
            expect(alertes[0].message).toContain('40 000 MRU');

            const eleve = await acteur('etudiant', { etudiantId });
            await appeler(synchroniserAlertes, {}, eleve);
            const [siennes] = (await db.collection(`utilisateurs/${eleve.uid}/alertes`).get()).docs.map((d) => d.data());
            expect(siennes).toMatchObject({ titre: 'Échéance de paiement dépassée', lien: '/portail/etudiant' });
        });

        it('calcule les indicateurs du tableau de bord pour l’année choisie', async () => {
            const [inscription] = await liste('inscriptions');
            await appeler(modifierSituationFinanciere, { id: inscription.id, montantDu: 100000, montantRemise: 20000 }, admin);
            const tableau = await appeler(tableauDeBordAdmin, { anneeId: '2026-2027' }, admin);
            expect(tableau).toMatchObject({
                anneeId: '2026-2027', montantFacture: 80000, encaisses: 0, resteARecouvrer: 80000, tauxRecouvrement: 0,
                totalEtudiants: 1, etudiantsActifs: 1, inscriptionsActives: 1,
            });
            expect(tableau.impayes[0]).toMatchObject({ etudiant: 'Awa Ba', formation: 'DGC', solde: 80000 });
            await attendreErreur(appeler(tableauDeBordAdmin, { anneeId: '1999-2000' }, admin), 'invalid-argument');
            await attendreErreur(appeler(tableauDeBordAdmin, {}, await acteur('finance')), 'permission-denied');
        });
    });

    describe('E-mails, sauvegardes et supervision', () => {
        it('marque un e-mail envoyé ou en échec selon le transport', async () => {
            const email = { destinataire: 'awa@example.com', nomDestinataire: 'Awa Ba', type: 'Test', sujet: 'Sujet', titre: 'Titre <b>', message: 'Message', lien: '/portail/etudiant' };
            const ref = await db.collection('journalEmails').add({ ...email, statut: 'En attente' });
            await expedier(ref.id, email, nodemailer.createTransport({ jsonTransport: true }));
            expect(await doc(`journalEmails/${ref.id}`)).toMatchObject({ statut: 'Envoyé', erreur: null });
            await expedier(ref.id, email, null);
            expect((await doc(`journalEmails/${ref.id}`))?.statut).toBe('Échec');
            const html = rendreEmail(email, 'https://dashboard.insec.test/');
            expect(html).toContain('Titre &lt;b&gt;');
            expect(html).toContain('https://dashboard.insec.test/portail/etudiant');
        });

        it('réserve la restauration au super-administrateur récemment authentifié', async () => {
            await attendreErreur(appeler(restaurerSauvegarde, { id: 'x', confirmation: 'RESTAURER' }, admin), 'permission-denied');
            const superAdmin = await acteur('super_admin');
            await attendreErreur(appeler(restaurerSauvegarde, { id: 'x', confirmation: 'restaurer' }, superAdmin), 'invalid-argument', 'confirmation');
            await attendreErreur(
                appeler(restaurerSauvegarde, { id: 'x', confirmation: 'RESTAURER' }, { ...superAdmin, authTime: Math.floor(Date.now() / 1000) - 3600 }),
                'unauthenticated',
            );
            await attendreErreur(appeler(restaurerSauvegarde, { id: 'x', confirmation: 'RESTAURER' }, superAdmin), 'failed-precondition');
        });

        it('signale la disponibilité et l’absence de sauvegarde comme simple avertissement', async () => {
            const rapport = await verifierDisponibilite();
            expect(rapport.checks.database.status).toBe('ok');
            expect(rapport.checks.storage.status).toBe('ok');
            expect(rapport.checks.backup.status).toBe('warning');
            expect(rapport.status).toBe('warning');
        });
    });
});
