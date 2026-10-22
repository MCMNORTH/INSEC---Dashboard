import { beforeEach, describe, expect, it } from 'vitest';
import { creerEtudiant } from '../src/handlers/etudiants.js';
import { enregistrerReglementBumex } from '../src/handlers/finances.js';
import { dateDuJour } from '../src/shared/domaine.js';
import { acteur, appeler, attendreErreur, doc, liste, referentiel, reinitialiser, type ActeurTest } from './aide.js';

describe('Règlement BUMEX d’une inscription', () => {
    let finance: ActeurTest;
    let bumexId: string;
    let etudiantId: string;
    const inscription = async (id: string) => (await doc(`inscriptions/${id}`))!;

    beforeEach(async () => {
        await reinitialiser();
        await referentiel();
        finance = await acteur('finance');
        const admin = await acteur('admin');
        const base = { statut: 'Actif', anneeId: '2026-2027', anneeParcours: 1, formationId: 'DGC', ueIds: ['TEC111', 'TEC119'] };
        await appeler(creerEtudiant, { ...base, nom: 'Sall', prenom: 'Moussa', financeur: 'bumex' }, admin);
        await appeler(creerEtudiant, { ...base, nom: 'Ba', prenom: 'Awa', financeur: 'etudiant' }, admin);
        const inscriptions = await liste('inscriptions');
        bumexId = inscriptions.find((i) => i.financeur === 'bumex')!.id;
        etudiantId = inscriptions.find((i) => i.financeur === 'etudiant')!.id;
    });

    it('enregistre le règlement (montant, date, référence) sans créer de versement, avec audit', async () => {
        await appeler(enregistrerReglementBumex, {
            inscriptionId: bumexId, regle: true, montant: 32000, dateReglement: '2026-10-05', reference: 'VIR-BUMEX-042',
        }, finance);
        expect(await inscription(bumexId)).toMatchObject({
            statutBumex: 'reglee', montantBumex: 32000, dateReglementBumex: '2026-10-05', referenceBumex: 'VIR-BUMEX-042',
        });
        expect(await liste('versements')).toHaveLength(0);
        expect((await liste('journalAudit')).some((a) => a.modele === 'Inscription' && a.modeleId === bumexId && a.action === 'updated')).toBe(true);
    });

    it('exige un montant et une date passée ou du jour', async () => {
        await attendreErreur(appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: true, dateReglement: '2026-10-05' }, finance), 'invalid-argument', 'montant');
        await attendreErreur(appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: true, montant: 32000 }, finance), 'invalid-argument', 'dateReglement');
        await attendreErreur(appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: true, montant: 32000, dateReglement: '2999-01-01' }, finance), 'invalid-argument', 'dateReglement');
        await appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: true, montant: 32000, dateReglement: dateDuJour() }, finance);
        expect((await inscription(bumexId)).statutBumex).toBe('reglee');
    });

    it('annule un règlement avec un motif obligatoire', async () => {
        await attendreErreur(appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: false, motif: 'Rien à annuler' }, finance), 'failed-precondition');
        await appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: true, montant: 32000, dateReglement: '2026-10-05' }, finance);
        await attendreErreur(appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: false }, finance), 'invalid-argument', 'motif');
        await appeler(enregistrerReglementBumex, { inscriptionId: bumexId, regle: false, motif: 'Virement rejeté par la banque' }, finance);
        expect(await inscription(bumexId)).toMatchObject({
            statutBumex: 'a_regler', dateReglementBumex: null, referenceBumex: null, motifAnnulationBumex: 'Virement rejeté par la banque',
        });
    });

    it('refuse une inscription à la charge de l’étudiant', async () => {
        await attendreErreur(
            appeler(enregistrerReglementBumex, { inscriptionId: etudiantId, regle: true, montant: 32000, dateReglement: '2026-10-05' }, finance),
            'failed-precondition',
        );
        expect((await inscription(etudiantId)).statutBumex).toBeUndefined();
    });

    it('refuse les rôles non autorisés et les visiteurs non connectés', async () => {
        const donnees = { inscriptionId: bumexId, regle: true, montant: 32000, dateReglement: '2026-10-05' };
        await attendreErreur(appeler(enregistrerReglementBumex, donnees, await acteur('enseignant')), 'permission-denied');
        await attendreErreur(appeler(enregistrerReglementBumex, donnees, await acteur('etudiant')), 'permission-denied');
        await attendreErreur(appeler(enregistrerReglementBumex, donnees, null), 'unauthenticated');
        expect((await inscription(bumexId)).statutBumex).not.toBe('reglee');
    });
});
