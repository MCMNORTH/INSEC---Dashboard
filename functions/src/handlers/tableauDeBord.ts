import { HttpsError } from 'firebase-functions/v2/https';
import { operation } from '../lib/contexte.js';
import { col, nomComplet, type Doc } from '../lib/donnees.js';
import { db, Timestamp } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import { montantEnRetard, montantNet, ROLES_ADMIN, soldeRestant, STATUTS_ETUDIANT } from '../shared/domaine.js';

const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const taux = (valides: number, total: number) => (total ? arrondi((valides / total) * 100) : 0);

export const tableauDeBordAdmin = operation('tableauDeBordAdmin', ROLES_ADMIN, async (donnees) => {
    const v = valider(z.object({ anneeId: s.texteOptionnel(50) }), donnees);
    const annees = (await col.annees().get()).docs.map((d) => ({ id: d.id, libelle: d.get('libelle') as string }))
        .sort((a, b) => b.libelle.localeCompare(a.libelle));
    const maintenant = new Date();
    const debutAnneeAcademique = maintenant.getUTCMonth() >= 8
        ? maintenant.getUTCFullYear()
        : maintenant.getUTCFullYear() - 1;
    const libelleAnneeCourante = `${debutAnneeAcademique}-${debutAnneeAcademique + 1}`;
    const anneeParDefaut = annees.find((a) => a.libelle === libelleAnneeCourante) ?? annees[0];
    const anneeId = v.anneeId ?? anneeParDefaut?.id ?? null;
    if (anneeId && !annees.some((a) => a.id === anneeId)) throw new HttpsError('invalid-argument', 'Année académique invalide.');

    const [inscriptionsSnap, formationsSnap, resultatsSnap, examensSnap, versementsSnap, uesSnap] = await Promise.all([
        anneeId ? col.inscriptions().where('anneeId', '==', anneeId).get() : col.inscriptions().get(),
        col.formations().get(),
        anneeId ? col.resultats().where('anneeId', '==', anneeId).where('note', '!=', null).get() : col.resultats().where('note', '!=', null).get(),
        col.examens().where('statut', '==', 'Planifié').where('dateExamen', '>=', Timestamp.now())
            .where('dateExamen', '<=', Timestamp.fromMillis(Date.now() + 30 * 24 * 3600 * 1000)).orderBy('dateExamen').get(),
        col.versements().where('statut', '==', 'Validée')
            .where('dateVersement', '>=', `${new Date().getUTCFullYear()}-01-01`).where('dateVersement', '<=', `${new Date().getUTCFullYear()}-12-31`).get(),
        col.ues().get(),
    ]);
    const inscriptions = inscriptionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as (Doc & { id: string })[];
    const idsInscriptions = new Set(inscriptions.map((i) => i.id));
    const formations = new Map(formationsSnap.docs.map((d) => [d.id, d.data() as Doc]));
    const ues = new Map(uesSnap.docs.map((d) => [d.id, d.data() as Doc]));
    const resultats = resultatsSnap.docs.map((d) => d.data()).filter((r) => idsInscriptions.has(r.inscriptionId));

    const somme = (f: (i: Doc) => number) => inscriptions.reduce((t, i) => t + f(i), 0);
    const montantFacture = somme((i) => montantNet(i as never));
    const encaisses = somme((i) => i.totalVerse ?? 0);
    const resteARecouvrer = somme((i) => soldeRestant(i as never));
    const retard = somme((i) => montantEnRetard(i as never));

    const parDiplome = new Map<string, Doc[]>();
    inscriptions.forEach((i) => {
        const code = formations.get(i.formationId)?.code ?? '—';
        parDiplome.set(code, [...(parDiplome.get(code) ?? []), i]);
    });
    const performanceDiplomes = [...parDiplome].map(([code, groupe]) => {
        const ids = new Set(groupe.map((i) => i.id));
        const notes = resultats.filter((r) => ids.has(r.inscriptionId));
        const valides = notes.filter((r) => r.valide).length;
        return { code, inscrits: new Set(groupe.map((i) => i.etudiantId)).size, notes: notes.length, valides, taux: taux(valides, notes.length) };
    });

    const parUe = new Map<string, Doc[]>();
    resultats.forEach((r) => parUe.set(r.ueId, [...(parUe.get(r.ueId) ?? []), r]));
    const performanceUes = [...parUe]
        .map(([ueId, notes]) => ({
            code: ues.get(ueId)?.code ?? ueId,
            libelle: ues.get(ueId)?.libelle ?? '',
            notes: notes.length,
            moyenne: arrondi(notes.reduce((t, r) => t + r.note, 0) / notes.length, 2),
            taux: taux(notes.filter((r) => r.valide).length, notes.length),
        }))
        .sort((a, b) => b.taux - a.taux)
        .slice(0, 8);

    const aSuivre = inscriptions.filter((i) => soldeRestant(i as never) > 0)
        .sort((a, b) => montantEnRetard(b as never) - montantEnRetard(a as never)).slice(0, 8);
    const etudiantsImpayes = aSuivre.length ? await db.getAll(...aSuivre.map((i) => col.etudiants().doc(i.etudiantId))) : [];
    const impayes = aSuivre.map((i, n) => ({
        inscriptionId: i.id, etudiantId: i.etudiantId, etudiant: nomComplet(etudiantsImpayes[n]?.data()),
        formation: formations.get(i.formationId)?.code ?? '—', solde: soldeRestant(i as never), retard: montantEnRetard(i as never),
    }));

    const examensProchains = examensSnap.docs.filter((e) => !anneeId || e.get('anneeId') === anneeId).slice(0, 6).map((e) => ({
        id: e.id, ue: ues.get(e.get('ueId'))?.code ?? '', dateExamen: e.get('dateExamen').toDate().toISOString(), salle: e.get('salle') ?? null,
    }));

    const paiements12 = Array.from({ length: 12 }, () => 0);
    versementsSnap.docs.filter((d) => idsInscriptions.has(d.get('inscriptionId')))
        .forEach((d) => (paiements12[Number(String(d.get('dateVersement')).slice(5, 7)) - 1] += d.get('montant')));

    const comptages = await Promise.all([
        ...STATUTS_ETUDIANT.map((statut) => col.etudiants().where('statut', '==', statut).count().get()),
        col.etudiants().count().get(),
        col.enseignants().count().get(),
    ]);
    const repartition = Object.fromEntries(STATUTS_ETUDIANT.map((statut, n) => [statut, comptages[n].data().count]));
    const totalEtudiants = comptages[STATUTS_ETUDIANT.length].data().count;
    const etudiantsInscrits = new Set(inscriptions.filter((i) => i.statut === 'active').map((i) => i.etudiantId)).size;
    const etudiantsSansInscription = Math.max(0, totalEtudiants - etudiantsInscrits);

    return {
        annees, anneeId, montantFacture, encaisses, resteARecouvrer, montantEnRetard: retard,
        tauxRecouvrement: montantFacture > 0 ? arrondi((encaisses / montantFacture) * 100) : 0,
        tauxReussite: taux(resultats.filter((r) => r.valide).length, resultats.length),
        performanceDiplomes, performanceUes, impayes, examensProchains, paiements12, repartition,
        totalEtudiants, etudiantsInscrits, etudiantsSansInscription,
        etudiantsActifs: repartition['Actif'] ?? 0,
        totalEnseignants: comptages[STATUTS_ETUDIANT.length + 1].data().count,
        inscriptionsActives: inscriptions.filter((i) => i.statut === 'active').length,
    };
});
