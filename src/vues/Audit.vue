<script setup lang="ts">
import {
    collection, endBefore, getDocs, limit, limitToLast, orderBy, query, startAfter, Timestamp, where,
    type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { onMounted, reactive, ref, shallowRef } from 'vue';
import { messageErreur } from '../api';
import Chargement from '../composants/Chargement.vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import type { JournalAudit, Utilisateur } from '../types';

const PAR_PAGE = 40;
const ACTIONS: Record<string, string> = {
    created: 'Création', updated: 'Modification', deleted: 'Suppression', download: 'Téléchargement', export: 'Export', import: 'Import',
    backup: 'Sauvegarde', backup_verify: 'Contrôle de sauvegarde', restore: 'Restauration',
};
const MODELES = ['AffectationEnseignant', 'Candidature', 'Echeance', 'Enseignant', 'Etudiant', 'Examen', 'Inscription', 'PieceAdministrative', 'ResultatExamen', 'User', 'Versement'];

const { donnees: utilisateurs } = useRequete<Utilisateur>(() => query(collection(db, 'utilisateurs'), orderBy('nom')));
const filtres = reactive({ action: '', modele: '', acteurId: '', du: '', au: '' });
const journaux = shallowRef<JournalAudit[]>([]);
const chargement = ref(true);
const erreur = ref('');
const page = ref(1);
let premier: QueryDocumentSnapshot | null = null;
let dernier: QueryDocumentSnapshot | null = null;
const suivante = ref(false);

function contraintes(): QueryConstraint[] {
    const c: QueryConstraint[] = [];
    if (filtres.action) c.push(where('action', '==', filtres.action));
    if (filtres.modele) c.push(where('modele', '==', filtres.modele));
    if (filtres.acteurId) c.push(where('acteurId', '==', filtres.acteurId));
    if (filtres.du) c.push(where('creeLe', '>=', Timestamp.fromDate(new Date(`${filtres.du}T00:00:00`))));
    if (filtres.au) c.push(where('creeLe', '<=', Timestamp.fromDate(new Date(`${filtres.au}T23:59:59`))));
    c.push(orderBy('creeLe', 'desc'));
    return c;
}

async function charger(sens: 'debut' | 'suivante' | 'precedente' = 'debut') {
    chargement.value = true;
    erreur.value = '';
    try {
        const pagination = sens === 'suivante' && dernier ? [startAfter(dernier), limit(PAR_PAGE + 1)]
            : sens === 'precedente' && premier ? [endBefore(premier), limitToLast(PAR_PAGE + 1)]
            : [limit(PAR_PAGE + 1)];
        const snap = await getDocs(query(collection(db, 'journalAudit'), ...contraintes(), ...pagination));
        let docs = snap.docs;
        if (sens === 'precedente') {
            docs = docs.length > PAR_PAGE ? docs.slice(1) : docs;
            suivante.value = true;
        } else {
            suivante.value = docs.length > PAR_PAGE;
            docs = docs.slice(0, PAR_PAGE);
        }
        page.value = sens === 'debut' ? 1 : page.value + (sens === 'suivante' ? 1 : -1);
        premier = docs[0] ?? null;
        dernier = docs.at(-1) ?? null;
        journaux.value = docs.map((d) => ({ id: d.id, ...d.data() }) as JournalAudit);
    } catch (e) {
        erreur.value = messageErreur(e);
    } finally {
        chargement.value = false;
    }
}
onMounted(() => charger());

const formaterValeur = (v: unknown) => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const style = (action: string) => (action === 'deleted' ? 'bg-red-50 text-red-600' : action === 'updated' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600');
const icone = (action: string) => (action === 'download' ? 'fa-download' : action === 'deleted' ? 'fa-trash' : action === 'export' ? 'fa-file-export' : 'fa-pen-to-square');
</script>

<template>
    <div class="mb-6">
        <p class="text-sm text-gray-500">Sécurité et traçabilité</p>
        <h1 class="titre-page">Journal d’audit</h1>
        <p class="mt-1 text-sm text-gray-500">Historique immuable des opérations sensibles réalisées dans le dashboard.</p>
    </div>
    <form class="mb-5 grid grid-cols-2 gap-3 rounded-xl border bg-white p-4 lg:grid-cols-6" @submit.prevent="charger()">
        <select v-model="filtres.action" class="champ" aria-label="Action"><option value="">Toutes les actions</option><option v-for="(l, v) in ACTIONS" :key="v" :value="v">{{ l }}</option></select>
        <select v-model="filtres.modele" class="champ" aria-label="Objet"><option value="">Tous les objets</option><option v-for="m in MODELES" :key="m">{{ m }}</option></select>
        <select v-model="filtres.acteurId" class="champ" aria-label="Utilisateur"><option value="">Tous les utilisateurs</option><option v-for="u in utilisateurs" :key="u.id" :value="u.id">{{ u.nom }}</option></select>
        <input v-model="filtres.du" type="date" class="champ" title="Du" aria-label="Du" />
        <input v-model="filtres.au" type="date" class="champ" title="Au" aria-label="Au" />
        <button class="bouton-principal">Filtrer</button>
    </form>
    <Chargement :chargement="chargement" :erreur="erreur" :vide="!journaux.length" message-vide="Aucune opération ne correspond aux filtres.">
        <div class="space-y-3">
            <article v-for="j in journaux" :key="j.id" class="rounded-xl border bg-white p-4">
                <div class="flex flex-wrap justify-between gap-3">
                    <div class="flex gap-3">
                        <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-full', style(j.action)]"><i :class="['fa-solid', icone(j.action)]"></i></span>
                        <div>
                            <p class="text-sm font-semibold text-insec">{{ j.description }}</p>
                            <p class="mt-1 text-xs text-gray-400">
                                {{ j.acteur || 'Système' }} · {{ j.creeLe?.toDate().toLocaleString('fr-FR') }} · {{ j.adresseIp || 'IP inconnue' }}<template v-if="j.operation"> · {{ j.operation }}</template>
                            </p>
                        </div>
                    </div>
                    <span v-if="j.modele" class="h-fit rounded-full bg-gray-100 px-3 py-1 text-xs">{{ j.modele }} #{{ j.modeleId }}</span>
                </div>
                <details v-if="j.avant || j.apres" class="mt-3 ml-12">
                    <summary class="cursor-pointer text-xs font-semibold text-gray-500">Voir les changements</summary>
                    <div class="mt-2 grid gap-3 text-xs md:grid-cols-2">
                        <div v-if="j.avant" class="rounded bg-red-50/50 p-3">
                            <strong>Avant</strong>
                            <dl class="mt-2 space-y-1"><div v-for="(v, k) in j.avant" :key="k"><dt class="inline text-gray-400">{{ k }} :</dt><dd class="inline break-all"> {{ formaterValeur(v) }}</dd></div></dl>
                        </div>
                        <div v-if="j.apres" class="rounded bg-green-50/50 p-3">
                            <strong>Après</strong>
                            <dl class="mt-2 space-y-1"><div v-for="(v, k) in j.apres" :key="k"><dt class="inline text-gray-400">{{ k }} :</dt><dd class="inline break-all"> {{ formaterValeur(v) }}</dd></div></dl>
                        </div>
                    </div>
                </details>
            </article>
        </div>
    </Chargement>
    <nav class="mt-5 flex items-center justify-between text-sm text-gray-600">
        <button class="bouton-secondaire" :disabled="page <= 1 || chargement" @click="charger('precedente')">‹ Précédent</button>
        <span>Page {{ page }}</span>
        <button class="bouton-secondaire" :disabled="!suivante || chargement" @click="charger('suivante')">Suivant ›</button>
    </nav>
</template>
