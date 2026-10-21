import { operation, type Acteur } from '../lib/contexte.js';
import { col, nomComplet, type Doc } from '../lib/donnees.js';
import { db, FieldValue, Timestamp } from '../lib/firebase.js';
import { formaterMontant, horaireExamen, montantEnRetard, ROLES_ADMIN, ROLES_FINANCE } from '../shared/domaine.js';

interface Alerte {
    cle: string;
    type: 'finance' | 'document' | 'examen' | 'resultat';
    niveau: 'danger' | 'warning' | 'info' | 'success';
    titre: string;
    message: string;
    lien: string | null;
}

const JOUR = 24 * 3600 * 1000;
const dans = (jours: number) => Timestamp.fromMillis(Date.now() + jours * JOUR);

async function codesUe(ids: string[]): Promise<Map<string, string>> {
    const uniques = [...new Set(ids)];
    const docs = uniques.length ? await db.getAll(...uniques.map((id) => col.ues().doc(id))) : [];
    return new Map(docs.map((d) => [d.id, (d.get('code') as string) ?? d.id]));
}

function alerteExamen(e: Doc, code: string, lien: string): Alerte {
    return {
        cle: `examen-${e.examenId ?? e.id}`, type: 'examen', niveau: 'info', titre: 'Examen à venir',
        message: `${code} — ${horaireExamen(e.dateExamen.toDate())}${e.salle ? ` (${e.salle})` : ''}.`, lien,
    };
}

export async function calculerAlertes(acteur: Pick<Acteur, 'role' | 'etudiantId' | 'enseignantId'>): Promise<Alerte[]> {
    const alertes: Alerte[] = [];
    const role = acteur.role;
    if (role && ROLES_FINANCE.includes(role)) {
        const inscriptions = (await col.inscriptions().where('statut', '==', 'active').get()).docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((i) => montantEnRetard(i as never) > 0);
        const etudiants = inscriptions.length ? await db.getAll(...inscriptions.map((i: Doc) => col.etudiants().doc(i.etudiantId))) : [];
        inscriptions.forEach((i: Doc, n) => alertes.push({
            cle: `retard-paiement-${i.id}`, type: 'finance', niveau: 'danger', titre: 'Paiement en retard',
            message: `${nomComplet(etudiants[n]?.data())} présente un retard de ${formaterMontant(montantEnRetard(i as never))} MRU.`,
            lien: `/finances?etudiant=${i.etudiantId}&inscription=${i.id}`,
        }));
    }
    if (role && ROLES_ADMIN.includes(role)) {
        const pieces = (await col.pieces().where('statut', 'in', ['À vérifier', 'Rejeté']).get()).docs;
        const etudiants = pieces.length ? await db.getAll(...pieces.map((p) => col.etudiants().doc(p.get('etudiantId')))) : [];
        pieces.forEach((p, n) => {
            const rejete = p.get('statut') === 'Rejeté';
            alertes.push({
                cle: `document-${p.id}-${p.get('statut')}`, type: 'document', niveau: rejete ? 'danger' : 'warning',
                titre: rejete ? 'Document rejeté à régulariser' : 'Document à vérifier',
                message: `${p.get('type')} — ${nomComplet(etudiants[n]?.data())}.`, lien: `/etudiants/${p.get('etudiantId')}/documents`,
            });
        });
        const examens = (await col.examens().where('statut', '==', 'Planifié').where('dateExamen', '>=', Timestamp.now()).where('dateExamen', '<=', dans(7)).get()).docs;
        const codes = await codesUe(examens.map((e) => e.get('ueId')));
        examens.forEach((e) => alertes.push(alerteExamen({ id: e.id, ...e.data() }, codes.get(e.get('ueId'))!, `/examens/${e.id}`)));
    }
    // Une même clé ne peut apparaître qu'une fois (ex. examen visible via plusieurs résultats).
    return [...new Map(alertes.map((a) => [a.cle, a])).values()];
}

export const synchroniserAlertes = operation('synchroniserAlertes', 'connecte', async (_donnees, acteur) => {
    const collection = col.utilisateurs().doc(acteur.uid!).collection('alertes');
    const [calculees, existantes] = await Promise.all([calculerAlertes(acteur), collection.get()]);
    const connues = new Map(existantes.docs.map((d) => [d.id, d]));
    const actives = new Set<string>();
    const lot = db.batch();
    for (const alerte of calculees) {
        const id = alerte.cle.replace(/\//g, '-');
        actives.add(id);
        const existante = connues.get(id);
        const inchangee = existante?.get('active') === true
            && (['titre', 'message', 'niveau', 'lien', 'type'] as const).every((c) => existante.get(c) === alerte[c]);
        if (inchangee) continue;
        lot.set(
            collection.doc(id),
            {
                ...alerte, active: true, modifieLe: FieldValue.serverTimestamp(),
                ...(existante ? {} : { lueLe: null, archiveeLe: null, creeLe: FieldValue.serverTimestamp() }),
            },
            { merge: true },
        );
    }
    for (const [id, doc] of connues) {
        if (!actives.has(id) && doc.get('active') && !doc.get('archiveeLe')) lot.update(doc.ref, { active: false });
    }
    await lot.commit();
    return { total: calculees.length };
});
