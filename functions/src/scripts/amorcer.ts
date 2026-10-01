/**
 * Amorçage de la base : référentiel INTEC-CNAM, premier super-administrateur et, en option, données de démonstration.
 *
 *   Émulateurs : npm run amorcer:local -- --demo
 *   Production : GCLOUD_PROJECT=<projet> SUPER_ADMIN_EMAIL=… SUPER_ADMIN_NOM=… npm run amorcer
 *   Après création, le super-administrateur définit son mot de passe via « Mot de passe oublié ».
 */
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db } from '../lib/firebase.js';
import { provisionnerCompte, type ProfilCompte } from '../handlers/comptes.js';

const FORMATIONS = [
    {
        code: 'DGC', nom: 'DGC', libelle: 'Diplôme de gestion et de comptabilité', dureeAnnees: 3, niveauDiplome: 'Bac +3', creditsTotal: 180,
        active: true, sourceUrl: 'https://intec.cnam.fr/presentation-du-diplome-de-gestion-et-de-comptabilite-dgc--1449587.kjsp', sourceVerifieeLe: '2026-09-20',
    },
    {
        code: 'DSGC', nom: 'DSGC', libelle: 'Diplôme supérieur de gestion et de comptabilité', dureeAnnees: 2, niveauDiplome: 'Bac +5', creditsTotal: 120,
        active: true, sourceUrl: 'https://intec.cnam.fr/diplome-superieur-de-gestion-et-de-comptabilite-dsgc--200729.kjsp', sourceVerifieeLe: '2026-09-20',
    },
];

const CATALOGUE: Record<string, [string, string, number, number][]> = {
    DGC: [
        ['TEC111', 'Fondamentaux du droit', 14, 1], ['TEC115', 'Économie contemporaine', 14, 1],
        ['TEC118', "Système d'information de gestion", 14, 1], ['TEC119', 'Comptabilité', 14, 1],
        ['TEC112', 'Droit des sociétés et des groupements d’affaires', 14, 2], ['TEC116', "Finance d'entreprise", 14, 2],
        ['TEC117', 'Management', 14, 2], ['TEC122', 'Anglais des affaires', 14, 2],
        ['TEC113', 'Droit social', 14, 3], ['TEC114', 'Droit fiscal', 14, 3], ['TEC120', 'Comptabilité approfondie', 14, 3],
        ['TEC121', 'Contrôle de gestion', 14, 3], ['TEC123', 'Communication professionnelle', 12, 3],
    ],
    DSGC: [
        ['TEC211', 'Gestion juridique, fiscale et sociale', 20, 1], ['TEC212', 'Finance', 15, 1],
        ['TEC213', 'Contrôle de gestion et stratégie', 20, 1], ['TEC214', 'Comptabilité et audit', 20, 2],
        ['TEC215', "Management des systèmes d'information", 15, 2], ['TEC217', 'Mémoire professionnel', 15, 2],
        ['TEC218', 'Anglais des affaires', 15, 2],
    ],
};

const ANNEES = ['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027', '2027-2028'];

async function referentiel() {
    const lot = db.batch();
    FORMATIONS.forEach((f) => lot.set(db.collection('formations').doc(f.code), f, { merge: true }));
    Object.entries(CATALOGUE).forEach(([formationId, ues]) =>
        ues.forEach(([code, libelle, credits, anneeParcours], index) =>
            lot.set(db.collection('ues').doc(code), { formationId, code, libelle, credits, anneeParcours, ordre: index + 1, active: true }, { merge: true }),
        ),
    );
    ANNEES.forEach((libelle) => lot.set(db.collection('annees').doc(libelle), { libelle }, { merge: true }));
    await lot.commit();
    console.log(`Référentiel : ${FORMATIONS.length} diplômes, ${Object.values(CATALOGUE).flat().length} UE, ${ANNEES.length} années.`);
}

async function compte(profil: ProfilCompte, motDePasse?: string) {
    const existant = await auth.getUserByEmail(profil.email).catch(() => null);
    const uid = existant?.uid ?? (await provisionnerCompte(profil, motDePasse));
    if (existant) {
        await auth.setCustomUserClaims(uid, {
            role: profil.role,
            ...(profil.etudiantId ? { etudiantId: profil.etudiantId } : {}),
            ...(profil.enseignantId ? { enseignantId: profil.enseignantId } : {}),
        });
    }
    await db.collection('utilisateurs').doc(uid).set(
        { ...profil, actif: true, creeLe: FieldValue.serverTimestamp(), modifieLe: FieldValue.serverTimestamp() },
        { merge: true },
    );
    console.log(`${existant ? 'Compte existant' : 'Compte créé'} : ${profil.email} (${profil.role})`);
}

async function demo() {
    const etudiants = [
        { id: 'demo-awa', nom: 'Ba', prenom: 'Awa', email: 'awa.ba@example.com', telephone: '22000001' },
        { id: 'demo-moussa', nom: 'Diallo', prenom: 'Moussa', email: 'moussa.diallo@example.com', telephone: '22000002' },
    ];
    const lot = db.batch();
    for (const [n, e] of etudiants.entries()) {
        const inscriptionId = `${e.id}-2026`;
        const ueIds = CATALOGUE.DGC.filter((u) => u[3] === 1).map((u) => u[0]);
        lot.set(db.collection('inscriptions').doc(inscriptionId), {
            etudiantId: e.id, formationId: 'DGC', anneeId: '2026-2027', anneeParcours: 1, dateInscription: '2026-09-15',
            numeroIntec: `INTEC-${1000 + n}`, statut: 'active', ueIds, montantDu: 150000, montantRemise: n ? 10000 : 0,
            noteFinanciere: null, totalVerse: 0, ordre: 1,
            echeances: [{ id: `${e.id}-t1`, libelle: '1re tranche', montant: 50000, dateEcheance: '2026-09-01' }],
            creeLe: FieldValue.serverTimestamp(), modifieLe: FieldValue.serverTimestamp(),
        });
        const { id, ...fiche } = e;
        lot.set(db.collection('etudiants').doc(id), {
            ...fiche, statut: 'Actif', derniere: { inscriptionId, formationId: 'DGC', anneeId: '2026-2027', statut: 'active' },
            formationIds: ['DGC'], anneeIds: ['2026-2027'], nbInscriptions: 1,
            creeLe: FieldValue.serverTimestamp(), modifieLe: FieldValue.serverTimestamp(),
        });
        lot.set(db.collection('uniques').doc(`etudiant-email:${e.email}`), { proprietaire: id });
    }
    lot.set(db.collection('enseignants').doc('demo-fatimetou'), {
        nom: 'Sidi', prenom: 'Fatimetou', specialite: 'Comptabilité', email: 'fatimetou.sidi@example.com', telephone: null,
        nbUe: 1, nbEtudiants: 2, creeLe: FieldValue.serverTimestamp(), modifieLe: FieldValue.serverTimestamp(),
    });
    lot.set(db.collection('uniques').doc('enseignant-email:fatimetou.sidi@example.com'), { proprietaire: 'demo-fatimetou' });
    lot.set(db.collection('affectations').doc('demo-fatimetou_TEC119'), {
        enseignantId: 'demo-fatimetou', ueId: 'TEC119', nombreEtudiants: 2, creeLe: FieldValue.serverTimestamp(),
    });
    await lot.commit();
    const motDePasse = 'insec-demo-2026';
    await compte({ nom: 'Admin Démo', email: 'admin@insec.test', role: 'admin', etudiantId: null, enseignantId: null }, motDePasse);
    await compte({ nom: 'Finance Démo', email: 'finance@insec.test', role: 'finance', etudiantId: null, enseignantId: null }, motDePasse);
    await compte({ nom: 'Fatimetou Sidi', email: 'enseignant@insec.test', role: 'enseignant', etudiantId: null, enseignantId: 'demo-fatimetou' }, motDePasse);
    await compte({ nom: 'Awa Ba', email: 'etudiant@insec.test', role: 'etudiant', etudiantId: 'demo-awa', enseignantId: null }, motDePasse);
    console.log(`Données de démonstration créées (mot de passe des comptes démo : ${motDePasse}).`);
}

async function principal() {
    await referentiel();
    const email = process.env.SUPER_ADMIN_EMAIL;
    const nom = process.env.SUPER_ADMIN_NOM;
    if (email && nom) {
        await compte({ nom, email: email.toLowerCase(), role: 'super_admin', etudiantId: null, enseignantId: null });
    } else {
        console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_NOM absents : aucun super-administrateur créé.');
    }
    if (process.argv.includes('--demo')) {
        if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Les données de démonstration sont réservées aux émulateurs.');
        await demo();
    }
}

principal().then(
    () => process.exit(0),
    (erreur) => {
        console.error(erreur);
        process.exit(1);
    },
);
