import { auditerModele, trace } from '../lib/audit.js';
import { operation } from '../lib/contexte.js';
import { col } from '../lib/donnees.js';
import { db } from '../lib/firebase.js';
import { erreurChamp, valider, z } from '../lib/validation.js';
import { ROLES_ADMIN } from '../shared/domaine.js';

const examenCalendrier = z.object({
    codeUE: z.string().regex(/^\\d{3}$/),
    intitule: z.string().trim().min(2).max(160),
    date: z.iso.date(),
    heure: z.string().regex(/^(?:[01]\\d|2[0-3]):[0-5]\\d$/),
    diplome: z.enum(['DGC', 'DSGC']),
});

const sourceOfficielle = (valeur: string): boolean => {
    try {
        const url = new URL(valeur);
        return url.protocol === 'https:' && url.hostname === 'intec.cnam.fr';
    } catch {
        return false;
    }
};

export const lireCalendriersIntec = operation('lireCalendriersIntec', ROLES_ADMIN, async () => {
    const documents = await col.calendriersIntec().get();
    return {
        calendriers: documents.docs.map((document) => ({
            annee: document.id,
            source: document.get('source') as string,
            examens: (document.get('examens') ?? []) as z.infer<typeof examenCalendrier>[],
        })),
    };
});

export const importerCalendrierIntec = operation('importerCalendrierIntec', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            annee: z.string().regex(/^20\\d{2}-20\\d{2}$/),
            source: z.string().url().max(2000),
            examens: z.array(examenCalendrier).min(1).max(100),
        }),
        donnees,
    );

    const [debut, fin] = v.annee.split('-').map(Number);
    if (fin !== debut + 1) erreurChamp('annee', 'L’année scolaire doit couvrir deux années consécutives.');
    if (!sourceOfficielle(v.source)) erreurChamp('source', 'La source doit provenir du site officiel intec.cnam.fr.');

    const codes = new Set<string>();
    const debutAnnee = `${debut}-09-01`;
    const finAnnee = `${fin}-08-31`;
    for (const examen of v.examens) {
        if (examen.date < debutAnnee || examen.date > finAnnee) {
            erreurChamp('examens', `La date de l’UE ${examen.codeUE} est hors de l’année scolaire sélectionnée.`);
        }
        if ((examen.diplome === 'DGC' && !examen.codeUE.startsWith('1')) || (examen.diplome === 'DSGC' && !examen.codeUE.startsWith('2'))) {
            erreurChamp('examens', `Le code UE ${examen.codeUE} ne correspond pas au diplôme ${examen.diplome}.`);
        }
        if (codes.has(examen.codeUE)) erreurChamp('examens', `L’UE ${examen.codeUE} apparaît plusieurs fois dans l’aperçu.`);
        codes.add(examen.codeUE);
    }

    const reference = col.calendriersIntec().doc(v.annee);
    await db.runTransaction(async (transaction) => {
        const document = await transaction.get(reference);
        const avant = document.exists ? document.data()! : null;
        const apres = {
            annee: v.annee,
            source: v.source,
            examens: v.examens,
            nombreExamens: v.examens.length,
        };
        transaction.set(reference, { ...apres, ...trace(acteur, !document.exists) });
        auditerModele(transaction, acteur, 'CalendrierIntec', v.annee, document.exists ? 'updated' : 'created', avant, apres);
    });

    return { message: `Calendrier INTEC ${v.annee} enregistré : ${v.examens.length} épreuve(s).` };
});
