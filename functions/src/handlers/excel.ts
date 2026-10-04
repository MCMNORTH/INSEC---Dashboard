import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { auditerDirect, auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, refUnique, type Doc } from '../lib/donnees.js';
import { db, FUSEAU } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import { dateDuJour, montantEnRetard, montantNet, ROLES_ADMIN, soldeRestant, statutPaiement, STATUTS_ETUDIANT, STATUTS_INSCRIPTION } from '../shared/domaine.js';
import { attributsInscription, cleEmailEtudiant, controlerInscription, resumeInscriptions } from './etudiants.js';

type Valeur = string | number | null | undefined;
const ENTETES_MODELE = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Statut étudiant', 'Code diplôme', 'Année académique', 'Année parcours', 'Codes UE', 'Date inscription (AAAA-MM-JJ)', 'N° INTEC', 'Statut inscription'];

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
    const { wb, feuille } = classeur('Registre étudiants', ENTETES_MODELE);
    const guide = wb.addWorksheet('Guide');
    guide.addRows([
        ['IMPORT DU REGISTRE INSEC'],
        ['Une ligne correspond à un étudiant et, au plus, une inscription annuelle. Répétez l’identité pour chaque année d’inscription. Les colonnes d’identité et le statut étudiant sont obligatoires.'],
        ['Pour créer aussi une inscription annuelle, renseignez le code diplôme, l’année académique, l’année de parcours et les codes UE.'],
        ['Les codes UE doivent être séparés par des points-virgules et appartenir au diplôme et à l’année de parcours indiqués.'],
        ['Sans information d’inscription, la ligne crée ou met à jour uniquement le dossier étudiant.'],
        ['Date inscription est facultative; si elle est vide, la date du jour est utilisée. Format attendu : AAAA-MM-JJ.'],
        ['Statut inscription est facultatif et vaut « active » par défaut. Valeurs acceptées : active, terminée, suspendue, annulée.'],
        ['Le CSV utilise les mêmes colonnes; les codes UE séparés par des points-virgules doivent rester dans une seule cellule.'],
        ['Ne modifiez pas les intitulés des colonnes de la feuille « Registre étudiants ».'],
    ]);
    guide.getColumn(1).width = 110;
    guide.getColumn(1).alignment = { wrapText: true, vertical: 'top' };
    guide.getRow(1).font = { bold: true, color: { argb: 'FF1E2761' }, size: 14 };
    guide.eachRow((row) => { row.height = 30; });
    return finaliser(wb, feuille, 'modele-import-registre-insec.xlsx');
}

async function etudiants() {
    const [{ formations, annees, ues }, liste, inscriptions] = await Promise.all([
        referentiel(), col.etudiants().orderBy('nom').get(), col.inscriptions().get(),
    ]);
    const parEtudiant = new Map<string, Doc[]>();
    for (const doc of inscriptions.docs) {
        const inscription = doc.data() as Doc;
        const existantes = parEtudiant.get(String(inscription.etudiantId)) ?? [];
        existantes.push({ id: doc.id, ...inscription });
        parEtudiant.set(String(inscription.etudiantId), existantes);
    }
    const { wb, feuille } = classeur('Registre étudiants', ENTETES_MODELE);
    for (const doc of liste.docs) {
        const etudiant = doc.data();
        const historiques = (parEtudiant.get(doc.id) ?? []).sort((a, b) => Number(a.ordre ?? 0) - Number(b.ordre ?? 0));
        const lignes = historiques.length ? historiques : [null];
        for (const inscription of lignes) {
            const formation = inscription ? formations.get(String(inscription.formationId)) : null;
            const annee = inscription ? annees.get(String(inscription.anneeId)) : null;
            const codesUE = inscription
                ? (Array.isArray(inscription.ueIds) ? inscription.ueIds : [])
                    .map((id: string) => String(ues.get(id)?.code ?? ''))
                    .filter(Boolean)
                    .join('; ')
                : '';
            ajouter(feuille, [
                etudiant.prenom, etudiant.nom, etudiant.email, etudiant.telephone, etudiant.statut,
                formation?.code, annee?.libelle, inscription?.anneeParcours, codesUE,
                inscription?.dateInscription, inscription?.numeroIntec, inscription?.statut,
            ]);
        }
    }
    return finaliser(wb, feuille, 'registre-etudiants-insec-' + suffixe() + '.xlsx');
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
        ? await (() => {
            const texte = contenu.toString('utf8').replace(/^\\uFEFF/, '');
            const entete = texte.split(/\\r?\\n/, 1)[0] ?? '';
            const nombre = (separateur: string) => (entete.match(new RegExp(separateur === ';' ? ';' : ',', 'g')) ?? []).length;
            const delimiteur = nombre(';') > nombre(',') ? ';' : ',';
            return wb.csv.read(Readable.from(texte), { parserOptions: { delimiter: delimiteur } });
        })()
        : (await wb.xlsx.load(contenu as never), wb.worksheets[0]);
    if (!feuille) return [];
    const lignes: string[][] = [];
    feuille.eachRow({ includeEmpty: true }, (ligne, numero) => {
        lignes[numero - 1] = Array.from({ length: ENTETES_MODELE.length }, (_, i) => String(ligne.getCell(i + 1).text ?? '').trim());
    });
    return Array.from(lignes, (l) => l ?? Array.from({ length: ENTETES_MODELE.length }, () => ''));
}

const ligneEtudiant = z.object({
    prenom: s.texte(100), nom: s.texte(100), email: s.email(), telephone: s.texteOptionnel(40), statut: s.choix(STATUTS_ETUDIANT),
});

type InscriptionImport = {
    formationId: string;
    anneeId: string;
    anneeParcours: number;
    dateInscription: string;
    numeroIntec: string | null;
    ueIds: string[];
    statut: (typeof STATUTS_INSCRIPTION)[number];
};

function inscriptionImport(ligne: string[], refs: Awaited<ReturnType<typeof referentiel>>): InscriptionImport | null {
    const cellules = ligne.slice(5, ENTETES_MODELE.length);
    if (cellules.every((valeur) => !valeur.trim())) return null;
    const [codeFormation, libelleAnnee, parcoursBrut, codesBruts, dateBrute, numeroIntecBrut, statutBrut] = cellules;
    if (!codeFormation || !libelleAnnee || !parcoursBrut || !codesBruts) {
        throw new Error('Pour créer une inscription, renseignez le diplôme, l’année académique, l’année parcours et au moins une UE.');
    }

    const formation = [...refs.formations.entries()].find(([, valeur]) =>
        String(valeur.code ?? '').trim().toLocaleUpperCase('fr-FR') === codeFormation.trim().toLocaleUpperCase('fr-FR'),
    );
    if (!formation) throw new Error('Code diplôme « ' + codeFormation + ' » inconnu.');
    const annee = [...refs.annees.entries()].find(([, valeur]) =>
        String(valeur.libelle ?? '').trim().toLocaleUpperCase('fr-FR') === libelleAnnee.trim().toLocaleUpperCase('fr-FR'),
    );
    if (!annee) throw new Error('Année académique « ' + libelleAnnee + ' » inconnue.');

    const anneeParcours = Number(parcoursBrut);
    if (!Number.isInteger(anneeParcours) || anneeParcours < 1 || anneeParcours > 10) {
        throw new Error('Année parcours doit être un nombre entier entre 1 et 10.');
    }
    const codesUE = codesBruts.split(';').map((code) => code.trim().toLocaleUpperCase('fr-FR')).filter(Boolean);
    if (!codesUE.length || new Set(codesUE).size !== codesUE.length) {
        throw new Error('Codes UE vides ou répétés; séparez les codes distincts par un point-virgule.');
    }
    const ueIds = codesUE.map((code) => {
        const correspondances = [...refs.ues.entries()].filter(([, valeur]) =>
            valeur.formationId === formation[0]
            && valeur.anneeParcours === anneeParcours
            && String(valeur.code ?? '').trim().toLocaleUpperCase('fr-FR') === code,
        );
        if (correspondances.length !== 1) {
            throw new Error('UE « ' + code + ' » introuvable ou ambiguë pour ' + codeFormation + ', année parcours ' + anneeParcours + '.');
        }
        return correspondances[0][0];
    });
    const statut = statutBrut
        ? valider(z.object({ statut: s.choix(STATUTS_INSCRIPTION) }), { statut: statutBrut.trim().toLocaleLowerCase('fr-FR') }).statut
        : 'active';
    return {
        formationId: formation[0],
        anneeId: annee[0],
        anneeParcours,
        dateInscription: (dateBrute ?? '').trim() ? valider(z.object({ date: s.date() }), { date: (dateBrute ?? '').trim() }).date : dateDuJour(),
        numeroIntec: (numeroIntecBrut ?? '').trim() || null,
        ueIds,
        statut,
    };
}

export const importerEtudiants = operation(
    'importerEtudiants',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const v = valider(
            z.object({
                nom: z.string().regex(/\.(xlsx|csv)$/i, 'Seuls les fichiers .xlsx et .csv sont acceptés.'),
                contenu: z.base64().max(7_000_000, 'Le fichier dépasse 5 Mo.'),
                mode: s.choix(['ignorer', 'mettre_a_jour'] as const),
                previsualiser: z.boolean().default(false),
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
        if (ENTETES_MODELE.some((e, i) => entetes[i] !== e)) {
            refuser('Les colonnes du fichier ne correspondent pas au modèle INSEC. Téléchargez le modèle actualisé.');
        }
        if (corps.length > 1000) refuser('L’import est limité à 1 000 lignes par fichier.');

        const refs = await referentiel();
        let crees = 0, misAJour = 0, ignores = 0, inscriptionsCreees = 0, inscriptionsExistantes = 0;
        const emailsTraites = new Set<string>();
        const erreurs: string[] = [];
        const lignesApercu: { ligne: number; etudiant: string; email: string; dossier: string; inscription: string }[] = [];
        const dossiersApercus = new Map<string, {
            sauve: boolean;
            initialementPresent: boolean;
            inscriptions: { formationId: string; anneeId: string; statut: string }[];
        }>();
        for (const [index, ligne] of corps.entries()) {
            const numero = index + 2;
            if (ligne.every((c) => c === '')) continue;
            try {
                const analyse = ligneEtudiant.safeParse({
                    prenom: ligne[0], nom: ligne[1], email: ligne[2], telephone: ligne[3], statut: ligne[4],
                });
                if (!analyse.success) {
                    erreurs.push('Ligne ' + numero + ' : ' + analyse.error.issues
                        .map((p) => String(p.path[0]) + ' — ' + p.message).join(' '));
                    continue;
                }
                const d = analyse.data;
                const inscription = inscriptionImport(ligne, refs);
                if (v.previsualiser) {
                    const cle = cleEmailEtudiant(d.email);
                    const resultat = await db.runTransaction(async (tx) => {
                        let etat = dossiersApercus.get(cle);
                        if (!etat) {
                            const unique = await tx.get(refUnique(cle));
                            if (unique.exists && v.mode === 'ignorer') {
                                return { type: 'ignore' as const, inscription: 'aucune' as const, etat: { sauve: true, initialementPresent: true, inscriptions: [] } };
                            }
                            const etudiantId = String(unique.get('proprietaire') ?? '');
                            if (unique.exists && !etudiantId) throw new Error('Le dossier étudiant lié à cet e-mail est introuvable.');
                            if (unique.exists) {
                                const etudiant = await tx.get(col.etudiants().doc(etudiantId));
                                if (!etudiant.exists) throw new Error('Le dossier étudiant lié à cet e-mail est introuvable.');
                            }
                            const inscriptions = unique.exists
                                ? await tx.get(col.inscriptions().where('etudiantId', '==', etudiantId))
                                : null;
                            etat = {
                                sauve: unique.exists,
                                initialementPresent: unique.exists,
                                inscriptions: inscriptions?.docs.map((doc) => ({
                                    formationId: String(doc.get('formationId') ?? ''),
                                    anneeId: String(doc.get('anneeId') ?? ''),
                                    statut: String(doc.get('statut') ?? ''),
                                })) ?? [],
                            };
                        }
                        if (etat.initialementPresent && v.mode === 'ignorer') {
                            return { type: 'ignore' as const, inscription: 'aucune' as const, etat };
                        }
                        const inscriptionsSimulees = [...etat.inscriptions];
                        let inscriptionResultat: 'aucune' | 'existante' | 'creee' = 'aucune';
                        if (inscription) {
                            const correspondantes = inscriptionsSimulees.filter((existante) =>
                                existante.formationId === inscription.formationId && existante.anneeId === inscription.anneeId,
                            );
                            const memeStatut = correspondantes.some((existante) => existante.statut === inscription.statut);
                            const activeExistante = correspondantes.some((existante) => existante.statut === 'active');
                            if (memeStatut || (inscription.statut === 'active' && activeExistante)) {
                                inscriptionResultat = 'existante';
                            } else if (inscription.statut !== 'active' && activeExistante) {
                                throw new Error('Une inscription active existe déjà pour ce diplôme et cette année scolaire.');
                            } else {
                                await controlerInscription(tx, inscription);
                                inscriptionsSimulees.push({
                                    formationId: inscription.formationId,
                                    anneeId: inscription.anneeId,
                                    statut: inscription.statut,
                                });
                                inscriptionResultat = 'creee';
                            }
                        }
                        return {
                            type: etat.sauve ? 'maj' as const : 'cree' as const,
                            inscription: inscriptionResultat,
                            etat: { sauve: true, initialementPresent: etat.initialementPresent, inscriptions: inscriptionsSimulees },
                        };
                    });
                    dossiersApercus.set(cle, resultat.etat);
                    if (resultat.type === 'ignore') ignores++;
                    else if (resultat.type === 'maj') misAJour++;
                    else crees++;
                    if (resultat.inscription === 'creee') inscriptionsCreees++;
                    else if (resultat.inscription === 'existante') inscriptionsExistantes++;
                    lignesApercu.push({
                        ligne: numero,
                        etudiant: `${d.prenom} ${d.nom}`,
                        email: d.email,
                        dossier: resultat.type === 'cree' ? 'À créer' : resultat.type === 'maj' ? 'À mettre à jour' : 'Ignoré',
                        inscription: resultat.inscription === 'creee' ? 'À créer'
                            : resultat.inscription === 'existante' ? 'Déjà présente'
                                : 'Aucune',
                    });
                    continue;
                }
                const resultat = await db.runTransaction(async (tx) => {
                    const unique = await tx.get(refUnique(cleEmailEtudiant(d.email)));
                    if (unique.exists && v.mode === 'ignorer' && !emailsTraites.has(cleEmailEtudiant(d.email))) {
                        return { type: 'ignore' as const, inscription: 'aucune' as const };
                    }
                    const etudiantId = unique.exists ? String(unique.get('proprietaire') ?? '') : col.etudiants().doc().id;
                    if (!etudiantId) throw new Error('Le dossier étudiant lié à cet e-mail est introuvable.');
                    const etudiantRef = col.etudiants().doc(etudiantId);
                    const avantSnapshot = unique.exists ? await tx.get(etudiantRef) : null;
                    if (unique.exists && !avantSnapshot?.exists) throw new Error('Le dossier étudiant lié à cet e-mail est introuvable.');
                    const avant = avantSnapshot?.data() ?? null;
                    const inscriptionsAvant = inscription
                        ? await tx.get(col.inscriptions().where('etudiantId', '==', etudiantId))
                        : null;

                    let inscriptionRef: FirebaseFirestore.DocumentReference | null = null;
                    let inscriptionDonnees: Doc | null = null;
                    let inscriptionResultat: 'aucune' | 'existante' | 'creee' = 'aucune';
                    if (inscription && inscriptionsAvant) {
                        const correspondantes = inscriptionsAvant.docs.filter((doc) =>
                            doc.get('formationId') === inscription.formationId && doc.get('anneeId') === inscription.anneeId,
                        );
                        const memeStatut = correspondantes.some((doc) => doc.get('statut') === inscription.statut);
                        const activeExistante = correspondantes.some((doc) => doc.get('statut') === 'active');
                        if (memeStatut || (inscription.statut === 'active' && activeExistante)) {
                            inscriptionResultat = 'existante';
                        } else if (inscription.statut !== 'active' && activeExistante) {
                            throw new Error('Une inscription active existe déjà pour ce diplôme et cette année scolaire.');
                        } else {
                            await controlerInscription(tx, inscription);
                            inscriptionRef = col.inscriptions().doc();
                            inscriptionDonnees = {
                                etudiantId,
                                ...attributsInscription(inscription, inscription.statut),
                                montantDu: 0, montantRemise: 0, noteFinanciere: null, totalVerse: 0, echeances: [],
                                ordre: (inscriptionsAvant?.size ?? 0) + 1,
                            };
                            inscriptionResultat = 'creee';
                        }
                    }

                    const cree = !unique.exists;
                    const toutes = inscriptionRef && inscriptionDonnees && inscriptionsAvant
                        ? [...inscriptionsAvant.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Doc) })), { id: inscriptionRef.id, ...inscriptionDonnees }]
                        : null;
                    const resume = toutes ? resumeInscriptions(toutes) : null;
                    const apres: Doc = cree
                        ? { ...d, ...(resume ?? { derniere: null, formationIds: [], anneeIds: [], nbInscriptions: 0 }) }
                        : { ...d, ...(resume ?? {}) };

                    if (cree) tx.set(etudiantRef, { ...apres, ...trace(acteur, true) });
                    else tx.update(etudiantRef, { ...apres, ...trace(acteur) });

                    if (inscriptionRef && inscriptionDonnees) {
                        tx.set(inscriptionRef, { ...inscriptionDonnees, ...trace(acteur, true) });
                        auditerModele(tx, acteur, 'Inscription', inscriptionRef.id, 'created', null, inscriptionDonnees);
                    }
                    auditerModele(tx, acteur, 'Etudiant', etudiantId, cree ? 'created' : 'updated', avant, apres);
                    return {
                        type: cree ? 'cree' as const : 'maj' as const,
                        inscription: inscriptionResultat,
                    };
                });

                if (resultat.type === 'ignore') ignores++;
                else {
                    emailsTraites.add(cleEmailEtudiant(d.email));
                    if (resultat.type === 'maj') misAJour++;
                    else crees++;
                }
                if (resultat.inscription === 'creee') inscriptionsCreees++;
                else if (resultat.inscription === 'existante') inscriptionsExistantes++;
            } catch (erreur) {
                const message = erreur instanceof Error ? erreur.message : 'Données invalides.';
                erreurs.push('Ligne ' + numero + ' : ' + message);
            }
        }
        if (v.previsualiser) return { crees, misAJour, ignores, inscriptionsCreees, inscriptionsExistantes, erreurs, lignes: lignesApercu };
        await auditerDirect(acteur, {
            action: 'import', description: 'Import Excel du registre étudiant',
            apres: {
                créés: crees, mis_à_jour: misAJour, ignorés: ignores,
                inscriptions_créées: inscriptionsCreees, inscriptions_existantes: inscriptionsExistantes, erreurs: erreurs.length,
            },
        });
        return { crees, misAJour, ignores, inscriptionsCreees, inscriptionsExistantes, erreurs };
    },
    { memory: '512MiB', timeoutSeconds: 300 },
);
