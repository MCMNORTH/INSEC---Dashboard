import { beforeEach, describe, expect, it } from 'vitest';
import { synchroniserAlertes } from '../src/handlers/alertes.js';
import { importerCalendrierIntec, lireCalendriersIntec } from '../src/handlers/calendriersIntec.js';
import { basculerCompte, creerCompte, modifierRoleCompte } from '../src/handlers/comptes.js';
import { enregistrerPiece, lireDocumentsFinanciers, modifierPiece, telechargerPiece } from '../src/handlers/documents.js';
import { creerEtudiant, modifierEtudiant, supprimerEtudiant } from '../src/handlers/etudiants.js';
import { creerExamen } from '../src/handlers/examens.js';
import { exporterExcel, importerEtudiants } from '../src/handlers/excel.js';
import { ajouterVersement, modifierTauxEuroMru } from '../src/handlers/finances.js';
import { envoyerDocumentParEmail, genererPdf } from '../src/handlers/pdf.js';
import { tableauDeBordAdmin } from '../src/handlers/tableauDeBord.js';
import { auth, bucket } from '../src/lib/firebase.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

const etudiant = {
    nom: 'Ba', prenom: 'Awa', email: 'awa@example.com', statut: 'Actif', formationId: 'DGC', anneeId: '2026-2027',
    anneeParcours: 1, dateInscription: '2026-09-20', ueIds: ['TEC111'],
};

describe('Administrateur (lecture seule)', () => {
    let admin: ActeurTest;
    let lecteur: ActeurTest;
    let etudiantId: string;
    let inscriptionId: string;
    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        admin = await acteur('admin');
        lecteur = await acteur('admin_lecture');
        ({ id: etudiantId } = await appeler(creerEtudiant, etudiant, admin));
        [{ id: inscriptionId }] = await liste('inscriptions');
    });

    it('est créé et attribué par le super-administrateur seulement', async () => {
        await attendreErreur(appeler(creerCompte, { nom: 'Lecteur', email: 'lecteur@example.com', role: 'admin_lecture' }, admin), 'permission-denied');
        const superAdmin = await acteur('super_admin');
        const { uid } = await appeler(creerCompte, { nom: 'Lecteur', email: 'lecteur@example.com', role: 'admin_lecture' }, superAdmin);
        expect((await auth.getUser(uid)).customClaims).toEqual({ role: 'admin_lecture' });
        expect(await doc(`utilisateurs/${uid}`)).toMatchObject({ role: 'admin_lecture', actif: true });
        // Un administrateur ne peut ni le désactiver, ni changer son rôle, ni donner ce rôle à un compte finance.
        await attendreErreur(appeler(basculerCompte, { uid }, admin), 'permission-denied');
        await attendreErreur(appeler(modifierRoleCompte, { uid, role: 'consultation' }, admin), 'permission-denied');
        const { uid: financeUid } = await appeler(creerCompte, { nom: 'Finance', email: 'finance@example.com', role: 'finance' }, admin);
        await attendreErreur(appeler(modifierRoleCompte, { uid: financeUid, role: 'admin_lecture' }, admin), 'permission-denied');
        await appeler(modifierRoleCompte, { uid: financeUid, role: 'admin_lecture' }, superAdmin);
        expect(await doc(`utilisateurs/${financeUid}`)).toMatchObject({ role: 'admin_lecture' });
    });

    it('consulte tout ce que consulte un administrateur : tableau de bord, calendriers, exports, pièces, documents', async () => {
        const tableau = await appeler(tableauDeBordAdmin, { anneeId: '2026-2027' }, lecteur);
        expect(tableau).toBeTruthy();
        expect(await appeler(lireCalendriersIntec, {}, lecteur)).toHaveProperty('calendriers');
        const fichier = await appeler(exporterExcel, { type: 'etudiants' }, lecteur);
        expect(fichier.contenu).toBeTruthy();
        expect(await appeler(lireDocumentsFinanciers, { anneeId: '2026-2027' }, lecteur)).toHaveProperty('documents');
        const attestation = await appeler(genererPdf, { type: 'attestation', id: inscriptionId }, lecteur);
        expect(Buffer.from(attestation.contenu, 'base64').subarray(0, 4).toString()).toBe('%PDF');

        const chemin = `dossiers/${etudiantId}/abc-identite.pdf`;
        await bucket().file(chemin).save(Buffer.from('%PDF-1.4 test'), { contentType: 'application/pdf' });
        const { id: pieceId } = await appeler(enregistrerPiece, { etudiantId, chemin, nomOriginal: 'identite.pdf', type: 'Pièce d’identité' }, admin);
        const piece = await appeler(telechargerPiece, { id: pieceId }, lecteur);
        expect(Buffer.from(piece.contenu, 'base64').toString()).toBe('%PDF-1.4 test');
        // Le téléchargement par le lecteur est journalisé comme celui d'un administrateur.
        expect((await liste('journalAudit')).some((a) => a.action === 'download' && a.modeleId === pieceId && a.acteurId === lecteur.uid)).toBe(true);
        await appeler(synchroniserAlertes, {}, lecteur);
    });

    it('ne peut rien modifier', async () => {
        // Chaque appel est lancé puis vérifié l’un après l’autre.
        const refus: (() => Promise<unknown>)[] = [
            () => appeler(creerEtudiant, { ...etudiant, email: 'autre@example.com' }, lecteur),
            () => appeler(modifierEtudiant, { id: etudiantId, ...etudiant }, lecteur),
            () => appeler(supprimerEtudiant, { id: etudiantId }, lecteur),
            () => appeler(creerExamen, {}, lecteur),
            () => appeler(importerCalendrierIntec, {}, lecteur),
            () => appeler(importerEtudiants, {}, lecteur),
            () => appeler(enregistrerPiece, {}, lecteur),
            () => appeler(modifierPiece, {}, lecteur),
            () => appeler(ajouterVersement, {}, lecteur),
            () => appeler(modifierTauxEuroMru, {}, lecteur),
            () => appeler(envoyerDocumentParEmail, {}, lecteur),
            () => appeler(creerCompte, { nom: 'X', email: 'x@example.com', role: 'consultation' }, lecteur),
            () => appeler(modifierRoleCompte, { uid: admin.uid, role: 'consultation' }, lecteur),
            () => appeler(basculerCompte, { uid: admin.uid }, lecteur),
        ];
        for (const appel of refus) await attendreErreur(appel(), 'permission-denied');
        expect(await liste('etudiants')).toHaveLength(1);
    });

    it('lit une facture déjà émise, mais n’en émet pas de nouvelle (pas de numéro attribué)', async () => {
        await attendreErreur(appeler(genererPdf, { type: 'facture', id: inscriptionId }, lecteur), 'failed-precondition');
        expect((await doc(`inscriptions/${inscriptionId}`))?.numeroFacture).toBeFalsy();
        await appeler(genererPdf, { type: 'facture', id: inscriptionId }, admin);
        const numero = (await doc(`inscriptions/${inscriptionId}`))?.numeroFacture;
        expect(numero).toBeTruthy();
        const facture = await appeler(genererPdf, { type: 'facture', id: inscriptionId }, lecteur);
        expect(Buffer.from(facture.contenu, 'base64').subarray(0, 4).toString()).toBe('%PDF');
        expect((await doc(`inscriptions/${inscriptionId}`))?.numeroFacture).toBe(numero);
    });
});
