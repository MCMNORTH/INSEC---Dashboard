import ExcelJS from 'exceljs';
import { auditerDirect, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col } from '../lib/donnees.js';
import { db } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import { ROLES_ADMIN } from '../shared/domaine.js';

const SOURCE = 'Resultat DCG-INSEC 2024-2025.xlsx';
const FEUILLES: Record<string, string> = {
    'fondamentaux du droit': 'TEC111',
    'economie contemporaine': 'TEC115',
    'systemes d information de gestion': 'TEC118',
    'comptabilite': 'TEC119',
};
const normaliser = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const normaliserIdentite = (v: string) => normaliser(v).split(' ').filter(Boolean).sort().join(' ');
const cellule = (v: ExcelJS.CellValue): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim();
    if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
    return String(v).trim();
};
const noter = (v: string): number | null => {
    if (!v || /^abs(?:ent)?$/i.test(v)) return null;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
type LigneSource = { cle: string; codeUe: string; libelleUe: string; nomSource: string; etudiantId: string | null; inscriptionId: string | null; note: number | null; noteSource: string; presence: 'Présent' | 'Absent'; ecarts: string[] };

async function lireClasseur(base64: string, nom: string): Promise<LigneSource[]> {
    if (!nom.toLocaleLowerCase().startsWith('resultat dcg-insec 2024-2025') || !nom.toLocaleLowerCase().endsWith('.xlsx')) refuser(`Le fichier doit être le classeur de référence : ${SOURCE}.`);
    if (base64.length > 8_000_000) refuser('Le classeur est trop volumineux (limite 6 Mo).');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(base64, 'base64') as any);
    const parCode = new Map((await col.ues().where('formationId', '==', 'DGC').get()).docs.map((d) => [String(d.get('code')).toUpperCase(), { ...d.data(), id: d.id }] as const));
    const [etudiants, inscriptions] = await Promise.all([col.etudiants().get(), col.inscriptions().where('anneeId', '==', '2024-2025').get()]);
    const identites = new Map<string, { id: string }>();
    etudiants.docs.forEach((d) => identites.set(normaliserIdentite(`${d.get('nom') ?? ''} ${d.get('prenom') ?? ''}`), { id: d.id }));
    const inscriptionsEtudiants = new Map<string, { id: string; ueIds: string[] }[]>();
    inscriptions.docs.forEach((d) => inscriptionsEtudiants.set(d.get('etudiantId'), [...(inscriptionsEtudiants.get(d.get('etudiantId')) ?? []), { id: d.id, ueIds: d.get('ueIds') ?? [] }]));
    const lignes: LigneSource[] = [];
    wb.eachSheet((sheet) => {
        const nomFeuille = normaliser(sheet.name);
        const codeUe = FEUILLES[nomFeuille];
        if (!codeUe) return;
        const ue = parCode.get(codeUe);
        const libelleUe = ue?.libelle ?? sheet.name;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber < 3) return;
            const nomFamille = cellule(row.getCell(3).value);
            const prenom = cellule(row.getCell(4).value);
            if (!nomFamille || !prenom) return;
            const brut = cellule(row.getCell(6).value);
            const deliberation = cellule(row.getCell(7).value);
            const valeur = deliberation || brut;
            if (!valeur) return;
            const etudiant = identites.get(normaliserIdentite(`${nomFamille} ${prenom}`));
            const dossiers = etudiant ? (inscriptionsEtudiants.get(etudiant.id) ?? []) : [];
            const dossier = dossiers.find((i) => !!ue && i.ueIds.includes(ue.id));
            const ecarts: string[] = [];
            if (!etudiant) ecarts.push('Candidat du classeur absent de l’annuaire des étudiants.');
            else if (!dossiers.length) ecarts.push('Aucune inscription 2024-2025 correspondante dans les dossiers financiers.');
            else if (!dossier) ecarts.push('UE du classeur absente de l’inscription enregistrée (écart à vérifier).');
            const absence = /^abs(?:ent)?$/i.test(valeur);
            const note = absence ? null : noter(valeur);
            if (!absence && note === null) ecarts.push(`Note non numérique conservée dans la source : ${valeur}`);
            const nomSource = `${prenom} ${nomFamille}`.trim();
            lignes.push({ cle: `2024-2025_${codeUe}_${normaliser(nomSource).replace(/ /g, '-')}`, codeUe, libelleUe, nomSource, etudiantId: etudiant?.id ?? null, inscriptionId: dossier?.id ?? null, note, noteSource: valeur, presence: absence ? 'Absent' : 'Présent', ecarts });
        });
    });
    if (!lignes.length) refuser('Aucun résultat lisible trouvé dans les quatre feuilles attendues du classeur.');
    return lignes;
}

const payload = z.object({ fichierBase64: s.texte(8_000_000), nomFichier: s.texte(150) });
export const analyserResultatsHistoriques = operation('analyserResultatsHistoriques', ROLES_ADMIN, async (donnees) => {
    const v = valider(payload, donnees);
    const lignes = await lireClasseur(v.fichierBase64, v.nomFichier);
    const apercu = lignes.map((l) => Object.fromEntries(Object.entries(l).filter(([cle]) => cle !== 'cle')));
    return { total: lignes.length, ecarts: lignes.filter((l) => l.ecarts.length).length, lignes: apercu };
});

export const importerResultatsHistoriques = operation('importerResultatsHistoriques', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(payload, donnees);
    const lignes = await lireClasseur(v.fichierBase64, v.nomFichier);
    const batch = db.batch();
    const collection = db.collection('resultatsHistoriques');
    lignes.forEach((l) => {
        const ref = collection.doc(l.cle);
        batch.set(ref, { anneeId: '2024-2025', codeUe: l.codeUe, libelleUe: l.libelleUe, dateExamen: '2025-05-05', source: SOURCE, nomSource: l.nomSource, etudiantId: l.etudiantId, inscriptionId: l.inscriptionId, note: l.note, noteSource: l.noteSource, presence: l.presence, ecarts: l.ecarts, ...trace(acteur, true) }, { merge: true });
    });
    await batch.commit();
    await auditerDirect(acteur, { action: 'Importation', modele: 'ResultatsHistoriques', modeleId: '2024-2025', description: `Import du classeur INTEC ${SOURCE} : ${lignes.length} lignes, ${lignes.filter((l) => l.ecarts.length).length} écarts signalés.`, avant: null, apres: { fichier: SOURCE, lignes: lignes.length, ecarts: lignes.filter((l) => l.ecarts.length).length } });
    return { message: `${lignes.length} résultats du classeur importés. Les écarts restent signalés et aucun dossier d’inscription n’a été créé.` };
});
