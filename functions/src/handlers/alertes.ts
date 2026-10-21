import { operation, type Acteur } from '../lib/contexte.js';
import { col, nomComplet, type Doc } from '../lib/donnees.js';
import { db, FieldValue, Timestamp } from '../lib/firebase.js';
import { formaterMontant, montantEnRetard, ROLES_ADMIN, ROLES_FINANCE } from '../shared/domaine.js';
import { formaterDateHeure } from './examens.js';

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
        message: `${code} — ${formaterDateHeure(e.dateExamen.toDate())}${e.salle ? ` (${e.salle})` : ''}.`, lien,
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
    if (role === 'etudiant' && acteur.etudiantId) {
        const [inscriptions, resultats, pieces] = await Promise.all([
            col.inscriptions().where('etudiantId', '==', acteur.etudiantId).get(),
            col.resultats().where('etudiantId', '==', acteur.etudiantId).get(),
            col.pieces().where('etudiantId', '==', acteur.etudiantId).where('statut', '==', 'Rejeté').get(),
        ]);
        inscriptions.docs.forEach((d) => {
            const retard = montantEnRetard(d.data() as never);
            if (retard > 0) alertes.push({
                cle: `mon-retard-${d.id}`, type: 'finance', niveau: 'danger', titre: 'Échéance de paiement dépassée',
                message: `Votre montant en retard est de ${formaterMontant(retard)} MRU.`, lien: '/portail/etudiant',
            });
        });
        const codes = await codesUe(resultats.docs.map((r) => r.get('ueId')));
        const maintenant = Date.now();
        resultats.docs.forEach((d) => {
            const r = d.data();
            const date = r.dateExamen.toMillis();
            if (r.statutExamen === 'Planifié' && date >= maintenant && date <= maintenant + 14 * JOUR) {
                alertes.push(alerteExamen(r, codes.get(r.ueId)!, '/portail/etudiant'));
            }
            if (r.note !== null && r.note !== undefined) alertes.push({
                cle: `resultat-${d.id}-${r.modifieLe?.toMillis?.() ?? 0}`, type: 'resultat', niveau: r.valide ? 'success' : 'warning',
                titre: 'Résultat publié', message: `${codes.get(r.ueId)} : ${r.note}/${r.noteSur}.`, lien: '/portail/etudiant',
            });
        });
        pieces.docs.forEach((p) => alertes.push({
            cle: `mon-document-${p.id}`, type: 'document', niveau: 'danger', titre: 'Document à remplacer',
            message: `${p.get('type')}${p.get('note') ? ` : ${p.get('note')}` : ' a été rejeté.'}`, lien: '/portail/etudiant',
        }));
    }
    if (role === 'enseignant' && acteur.enseignantId) {
        const ueIds = (await col.affectations().where('enseignantId', '==', acteur.enseignantId).get()).docs.map((a) => a.get('ueId') as string);
        for (let i = 0; i < ueIds.length; i += 30) {
            const examens = (await col.examens().where('ueId', 'in', ueIds.slice(i, i + 30)).where('statut', '==', 'Planifié')
                .where('dateExamen', '>=', Timestamp.now()).where('dateExamen', '<=', dans(14)).get()).docs;
            const codes = await codesUe(examens.map((e) => e.get('ueId')));
            examens.forEach((e) => alertes.push(alerteExamen({ id: e.id, ...e.data() }, codes.get(e.get('ueId'))!, '/portail/enseignant')));
        }
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
