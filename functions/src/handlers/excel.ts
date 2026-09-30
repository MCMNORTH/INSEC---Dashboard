import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { auditerDirect, auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, refUnique, verifierUnique, type Doc } from '../lib/donnees.js';
import { db, FUSEAU } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import { dateDuJour, montantEnRetard, montantNet, ROLES_ADMIN, soldeRestant, statutPaiement, STATUTS_ETUDIANT } from '../shared/domaine.js';
import { cleEmailEtudiant } from './etudiants.js';

type Valeur = string | number | null | undefined;
const ENTETES_MODELE = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Statut'];

function classeur(titre: string, entetes: string[]) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'INSEC Dashboard';
    const feuille = wb.addWorksheet(titre.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    const ligne = feuille.addRow(entetes);
    ligne.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2761' } };
    });
    feuille.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: entetes.length } };
    return { wb, feuille };
}

async function finaliser(wb: ExcelJS.Workbook, feuille: ExcelJS.Worksheet, nom: string) {
    feuille.columns.forEach((colonne) => {
        let largeur = 10;
        colonne.eachCell?.({ includeEmpty: false }, (c) => (largeur = Math.max(largeur, String(c.text ?? '').length + 2)));
        colonne.width = Math.min(largeur, 50);
    });
    const buffer = await wb.xlsx.writeBuffer();
    return { nom, contenu: Buffer.from(buffer).toString('base64') };
}

const ajouter = (feuille: ExcelJS.Worksheet, valeurs: Valeur[]) =>
    feuille.addRow(valeurs.map((v) => (typeof v === 'number' ? v : (v ?? '').toString())));

const suffixe = () => dateDuJour().replace(/-/g, '');
const parId = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => new Map(docs.map((d) => [d.id, d.data() as Doc]));

async function referentiel() {
    const [formations, annees, ues] = await Promise.all([col.formations().get(), col.annees().get(), col.ues().get()]);
    return { formations: parId(formations.docs), annees: parId(annees.docs), ues: parId(ues.docs) };
}

async function modele() {
    const { wb, feuille } = classeur('Modèle import étudiants', ENTETES_MODELE);
    ajouter(feuille, ['Awa', 'Ba', 'awa@example.com', '22000000', 'Actif']).font = { color: { argb: 'FF777777' } };
    return finaliser(wb, feuille, 'modele-import-etudiants.xlsx');
}

async function etudiants() {
    const [{ formations, annees }, liste, inscriptions] = await Promise.all([
        referentiel(), col.etudiants().orderBy('nom').get(), col.inscriptions().get(),
    ]);
    const parInscription = parId(inscriptions.docs);
    const { wb, feuille } = classeur('Étudiants', [
        'ID', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Statut étudiant', 'Diplôme actuel', 'Année académique', 'Année parcours', 'N° INTEC', 'Statut inscription',
    ]);
    for (const d of liste.docs) {
        const e = d.data();
        const i = e.derniere ? parInscription.get(e.derniere.inscriptionId) : undefined;
        ajouter(feuille, [
            d.id, e.prenom, e.nom, e.email, e.telephone, e.statut, i ? formations.get(i.formationId)?.code : null,
            i ? annees.get(i.anneeId)?.libelle : null, i?.anneeParcours, i?.numeroIntec, i?.statut,
        ]);
    }
    return finaliser(wb, feuille, `etudiants-insec-${suffixe()}.xlsx`);
}

async function finances() {
    const [{ formations, annees }, inscriptions, liste] = await Promise.all([
        referentiel(), col.inscriptions().get(), col.etudiants().get(),
    ]);
    const parEtudiant = parId(liste.docs);
    const { wb, feuille } = classeur('Finances', [
        'Étudiant', 'E-mail', 'Diplôme', 'Année académique', 'Montant dû', 'Remise', 'Montant net', 'Total versé', 'Solde restant', 'Montant en retard', 'Statut paiement',
    ]);
    const triees = inscriptions.docs.map((d) => d.data()).sort((a, b) => b.creeLe?.toMillis() - a.creeLe?.toMillis());
    for (const i of triees) {
        const e = parEtudiant.get(i.etudiantId);
        const f = i as never;
        ajouter(feuille, [
            `${e?.prenom ?? ''} ${e?.nom ?? ''}`.trim(), e?.email, formations.get(i.formationId)?.code, annees.get(i.anneeId)?.libelle,
            i.montantDu, i.montantRemise, montantNet(f), i.totalVerse, soldeRestant(f), montantEnRetard(f), statutPaiement(f),
        ]);
    }
    feuille.getColumn(5).numFmt = feuille.getColumn(6).numFmt = feuille.getColumn(7).numFmt = '#,##0 "MRU"';
    feuille.getColumn(8).numFmt = feuille.getColumn(9).numFmt = feuille.getColumn(10).numFmt = '#,##0 "MRU"';
    return finaliser(wb, feuille, `finances-insec-${suffixe()}.xlsx`);
}

async function resultats() {
    const [{ formations, ues }, liste, etudiantsSnap] = await Promise.all([
        referentiel(), col.resultats().where('note', '!=', null).get(), col.etudiants().get(),
    ]);
    const parEtudiant = parId(etudiantsSnap.docs);
    const { wb, feuille } = classeur('Résultats', [
        'Étudiant', 'E-mail', 'Diplôme', 'UE', 'Libellé UE', 'Session', 'Date examen', 'Présence', 'Note', 'Note sur', 'Décision',
    ]);
    const format = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'short', timeStyle: 'short' });
    for (const d of liste.docs) {
        const r = d.data();
        const e = parEtudiant.get(r.etudiantId);
        const ue = ues.get(r.ueId);
        ajouter(feuille, [
            `${e?.prenom ?? ''} ${e?.nom ?? ''}`.trim(), e?.email, formations.get(r.formationId)?.code, ue?.code, ue?.libelle,
            r.session, format.format(r.dateExamen.toDate()), r.presence, r.note, r.noteSur, r.valide ? 'Validée' : 'Non validée',
        ]);
    }
    feuille.getColumn(9).numFmt = feuille.getColumn(10).numFmt = '0.00';
    return finaliser(wb, feuille, `resultats-insec-${suffixe()}.xlsx`);
}

const EXPORTS = {
    modele: [modele, 'Téléchargement du modèle d’import étudiants'],
    etudiants: [etudiants, 'Export Excel des étudiants'],
    finances: [finances, 'Export Excel des finances'],
    resultats: [resultats, 'Export Excel des résultats'],
} as const;

export const exporterExcel = operation(
    'exporterExcel',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const { type } = valider(z.object({ type: s.choix(['modele', 'etudiants', 'finances', 'resultats'] as const) }), donnees);
        const [generer, description] = EXPORTS[type];
        const fichier = await generer();
        await auditerDirect(acteur, { action: 'export', description });
        return fichier;
    },
    { memory: '512MiB', timeoutSeconds: 120 },
);

async function lireLignes(nom: string, contenu: Buffer): Promise<string[][]> {
    const wb = new ExcelJS.Workbook();
    const feuille = nom.toLowerCase().endsWith('.csv')
        ? await wb.csv.read(Readable.from(contenu))
        : (await wb.xlsx.load(contenu as never), wb.worksheets[0]);
    if (!feuille) return [];
    const lignes: string[][] = [];
    feuille.eachRow({ includeEmpty: true }, (ligne, numero) => {
        lignes[numero - 1] = Array.from({ length: 5 }, (_, i) => String(ligne.getCell(i + 1).text ?? '').trim());
    });
    return Array.from(lignes, (l) => l ?? ['', '', '', '', '']);
}

const ligneEtudiant = z.object({
    prenom: s.texte(100), nom: s.texte(100), email: s.email(), telephone: s.texteOptionnel(40), statut: s.choix(STATUTS_ETUDIANT),
});

export const importerEtudiants = operation(
    'importerEtudiants',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const v = valider(
            z.object({
                nom: z.string().regex(/\.(xlsx|csv)$/i, 'seuls les fichiers .xlsx et .csv sont acceptés.'),
                contenu: z.base64().max(7_000_000, 'le fichier dépasse 5 Mo.'),
                mode: s.choix(['ignorer', 'mettre_a_jour'] as const),
            }),
            donnees,
        );
        let lignes: string[][];
        try {
            lignes = await lireLignes(v.nom, Buffer.from(v.contenu, 'base64'));
        } catch {
            refuser('Le fichier est illisible ou n’est pas un classeur Excel valide.');
        }
        const [entetes = [], ...corps] = lignes;
        if (ENTETES_MODELE.some((e, i) => entetes[i] !== e)) refuser('Les colonnes du fichier ne correspondent pas au modèle INSEC.');

        let crees = 0, misAJour = 0, ignores = 0;
        const erreurs: string[] = [];
        for (const [index, ligne] of corps.entries()) {
            const numero = index + 2;
            if (ligne.every((c) => c === '')) continue;
            const analyse = ligneEtudiant.safeParse({ prenom: ligne[0], nom: ligne[1], email: ligne[2], telephone: ligne[3], statut: ligne[4] });
            if (!analyse.success) {
                erreurs.push(`Ligne ${numero} : ${analyse.error.issues.map((p) => `${String(p.path[0])} — ${p.message}`).join(' ')}`);
                continue;
            }
            const d = analyse.data;
            const resultat = await db.runTransaction(async (tx) => {
                const unique = await tx.get(refUnique(cleEmailEtudiant(d.email)));
                if (unique.exists) {
                    if (v.mode === 'ignorer') return 'ignore';
                    const ref = col.etudiants().doc(unique.get('proprietaire'));
                    const avant = (await tx.get(ref)).data() ?? {};
                    tx.update(ref, { ...d, ...trace(acteur) });
                    auditerModele(tx, acteur, 'Etudiant', ref.id, 'updated', avant, d);
                    return 'maj';
                }
                const ref = col.etudiants().doc();
                const reserver = await verifierUnique(tx, cleEmailEtudiant(d.email), ref.id, 'E-mail déjà utilisé.', 'email');
                reserver();
                const etudiant = { ...d, derniere: null, formationIds: [], anneeIds: [], nbInscriptions: 0 };
                tx.set(ref, { ...etudiant, ...trace(acteur, true) });
                auditerModele(tx, acteur, 'Etudiant', ref.id, 'created', null, etudiant);
                return 'cree';
            });
            if (resultat === 'ignore') ignores++;
            else if (resultat === 'maj') misAJour++;
            else crees++;
        }
        await auditerDirect(acteur, {
            action: 'import', description: 'Import Excel des étudiants',
            apres: { créés: crees, mis_à_jour: misAJour, ignorés: ignores, erreurs: erreurs.length },
        });
        return { crees, misAJour, ignores, erreurs };
    },
    { memory: '512MiB', timeoutSeconds: 300 },
);
