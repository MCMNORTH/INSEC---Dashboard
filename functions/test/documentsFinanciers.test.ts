import { beforeEach, describe, expect, it } from 'vitest';
import { enregistrerDocumentFinancier, lireDocumentsFinanciers, retirerDocumentFinancier, telechargerDocumentFinancier } from '../src/handlers/documents.js';
import { bucket, db } from '../src/lib/firebase.js';
import { acteur, appeler, attendreErreur, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const PDF = Buffer.from('%PDF-1.4 facture test');

describe('Documents financiers annuels', () => {
    let finance: ActeurTest;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        finance = await acteur('finance');
    });

    async function deposer(qui: ActeurTest, type = 'facture-intec', anneeId = '2026-2027') {
        const chemin = `finances/${anneeId}/${type}/${qui.uid}/1-facture.pdf`;
        await bucket().file(chemin).save(PDF, { contentType: 'application/pdf' });
        return { chemin, resultat: await appeler(enregistrerDocumentFinancier, { anneeId, type, chemin, nomOriginal: 'facture.pdf' }, qui) };
    }

    it('enregistre, liste et télécharge une facture INTEC, avec trace dans le journal', async () => {
        const { resultat } = await deposer(finance);
        const { documents } = await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, finance);
        expect(documents).toHaveLength(1);
        expect(documents[0]).toMatchObject({ id: resultat.id, type: 'facture-intec', nomOriginal: 'facture.pdf', ancienFormat: false });
        const fichier = await appeler(telechargerDocumentFinancier, { id: resultat.id }, finance);
        expect(Buffer.from(fichier.contenu, 'base64').toString()).toBe(PDF.toString());
        const journal = await liste('journalAudit');
        expect(journal.some((j) => j.modele === 'DocumentFinancier' && j.action === 'download')).toBe(true);
    });

    it('lit et télécharge aussi les documents enregistrés dans l’ancien format (un document par année)', async () => {
        await bucket().file('finances/2025-2026/justificatif-paiement.pdf').save(PDF, { contentType: 'application/pdf' });
        await db.doc('documentsFinanciers/2025-2026').set({
            justificatifPaiement: { chemin: 'finances/2025-2026/justificatif-paiement.pdf', mimeType: 'application/pdf', nomOriginal: 'recu.pdf', taille: PDF.length },
        });
        const { documents } = await appeler(lireDocumentsFinanciers, { anneeId: '2025-2026' }, finance);
        expect(documents).toEqual([expect.objectContaining({ id: '2025-2026', type: 'justificatif-paiement', ancienFormat: true })]);
        const fichier = await appeler(telechargerDocumentFinancier, { id: '2025-2026', type: 'justificatif-paiement' }, finance);
        expect(fichier.nom).toBe('recu.pdf');
    });

    it('refuse un fichier déposé dans le dossier d’un autre utilisateur ou hors des types prévus', async () => {
        const autre = await acteur('finance');
        const chemin = `finances/2026-2027/facture-intec/${autre.uid}/1-facture.pdf`;
        await bucket().file(chemin).save(PDF, { contentType: 'application/pdf' });
        await attendreErreur(appeler(enregistrerDocumentFinancier, { anneeId: '2026-2027', type: 'facture-intec', chemin, nomOriginal: 'f.pdf' }, finance), 'invalid-argument', 'fichier');
        await attendreErreur(appeler(enregistrerDocumentFinancier, { anneeId: '2026-2027', type: 'autre', chemin, nomOriginal: 'f.pdf' }, finance), 'invalid-argument', 'type');
    });

    it('refuse un fichier qui n’est pas un PDF et le supprime du stockage', async () => {
        const chemin = `finances/2026-2027/facture-intec/${finance.uid}/1-image.png`;
        await bucket().file(chemin).save(Buffer.from('png'), { contentType: 'image/png' });
        await attendreErreur(appeler(enregistrerDocumentFinancier, { anneeId: '2026-2027', type: 'facture-intec', chemin, nomOriginal: 'i.png' }, finance), 'invalid-argument', 'fichier');
        expect((await bucket().file(chemin).exists())[0]).toBe(false);
    });

    it('réserve les documents financiers à la finance et à l’administration', async () => {
        const { resultat } = await deposer(finance);
        await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, await acteur('admin'));
        for (const role of ['enseignant', 'etudiant'] as const) {
            const qui = await acteur(role);
            await attendreErreur(appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, qui), 'permission-denied');
            await attendreErreur(appeler(telechargerDocumentFinancier, { id: resultat.id }, qui), 'permission-denied');
        }
        await attendreErreur(appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, null), 'unauthenticated');
    });
    it('permet au super-administrateur de retirer un document ; le PDF est archivé et le retrait journalisé', async () => {
        const superAdmin = await acteur('super_admin');
        const { chemin, resultat } = await deposer(finance);
        await appeler(retirerDocumentFinancier, { id: resultat.id }, superAdmin);
        expect((await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, finance)).documents).toEqual([]);
        expect((await bucket().file(chemin).exists())[0]).toBe(false);
        const [archives] = await bucket().getFiles({ prefix: 'archives/finances/2026-2027/facture-intec/' });
        expect(archives).toHaveLength(1);
        const journal = await liste('journalAudit');
        expect(journal.some((j) => j.modele === 'DocumentFinancier' && j.modeleId === resultat.id && j.action === 'deleted')).toBe(true);
    });

    it('retire aussi un document de l’ancien format sans toucher à l’autre document de l’année', async () => {
        const superAdmin = await acteur('super_admin');
        for (const type of ['facture-intec', 'justificatif-paiement']) {
            await bucket().file(`finances/2025-2026/${type}.pdf`).save(PDF, { contentType: 'application/pdf' });
        }
        await db.doc('documentsFinanciers/2025-2026').set({
            factureIntec: { chemin: 'finances/2025-2026/facture-intec.pdf', mimeType: 'application/pdf', nomOriginal: 'facture.pdf', taille: PDF.length },
            justificatifPaiement: { chemin: 'finances/2025-2026/justificatif-paiement.pdf', mimeType: 'application/pdf', nomOriginal: 'recu.pdf', taille: PDF.length },
        });
        await appeler(retirerDocumentFinancier, { id: '2025-2026', type: 'facture-intec' }, superAdmin);
        const { documents } = await appeler(lireDocumentsFinanciers, { anneeId: '2025-2026' }, finance);
        expect(documents).toEqual([expect.objectContaining({ type: 'justificatif-paiement', nomOriginal: 'recu.pdf' })]);
    });

    it('permet au super-administrateur de remplacer un PDF par un autre de la même année et du même type', async () => {
        const superAdmin = await acteur('super_admin');
        const { chemin: ancien, resultat } = await deposer(finance);
        const chemin = `finances/2026-2027/facture-intec/${superAdmin.uid}/2-facture-corrigee.pdf`;
        await bucket().file(chemin).save(PDF, { contentType: 'application/pdf' });
        const nouveau = await appeler(enregistrerDocumentFinancier,
            { anneeId: '2026-2027', type: 'facture-intec', chemin, nomOriginal: 'facture-corrigee.pdf', remplace: { id: resultat.id } }, superAdmin);
        const { documents } = await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, finance);
        expect(documents).toEqual([expect.objectContaining({ id: nouveau.id, nomOriginal: 'facture-corrigee.pdf' })]);
        expect((await bucket().file(ancien).exists())[0]).toBe(false);

        // Un justificatif ne peut pas remplacer une facture.
        const autre = `finances/2026-2027/justificatif-paiement/${superAdmin.uid}/3-recu.pdf`;
        await bucket().file(autre).save(PDF, { contentType: 'application/pdf' });
        await attendreErreur(appeler(enregistrerDocumentFinancier,
            { anneeId: '2026-2027', type: 'justificatif-paiement', chemin: autre, nomOriginal: 'recu.pdf', remplace: { id: nouveau.id } }, superAdmin), 'invalid-argument', 'remplace');
    });

    it('refuse le retrait et le remplacement à tous les autres rôles, administrateurs compris', async () => {
        const { resultat } = await deposer(finance);
        for (const role of ['admin', 'admin_lecture', 'finance', 'consultation', 'enseignant', 'etudiant'] as const) {
            const qui = await acteur(role);
            await attendreErreur(appeler(retirerDocumentFinancier, { id: resultat.id }, qui), 'permission-denied');
        }
        const admin = await acteur('admin');
        const chemin = `finances/2026-2027/facture-intec/${admin.uid}/2-facture.pdf`;
        await bucket().file(chemin).save(PDF, { contentType: 'application/pdf' });
        await attendreErreur(appeler(enregistrerDocumentFinancier,
            { anneeId: '2026-2027', type: 'facture-intec', chemin, nomOriginal: 'f.pdf', remplace: { id: resultat.id } }, admin), 'permission-denied');
        await attendreErreur(appeler(retirerDocumentFinancier, { id: resultat.id }, null), 'unauthenticated');
        expect((await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, finance)).documents).toHaveLength(1);
    });
});
