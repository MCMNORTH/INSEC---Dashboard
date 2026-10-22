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
const style = (action: string) => (action === 'deleted' ? 'bg-red-50 text-red-600' : action === 'updated' ? 'bg-amber-50 text-amber-600' : 'bg-insec-50 text-insec-600');
const icone = (action: string) => (action === 'download' ? 'fa-download' : action === 'deleted' ? 'fa-trash' : action === 'export' ? 'fa-file-export' : 'fa-pen-to-square');
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Sécurité et traçabilité</p>
            <h1 class="titre-page mt-1.5">Journal d’audit</h1>
            <p class="sous-titre">Historique immuable des opérations sensibles réalisées dans le dashboard.</p>
        </div>
    </header>
    <form class="carte mb-5 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6" @submit.prevent="charger()">
        <select v-model="filtres.action" class="champ" aria-label="Action"><option value="">Toutes les actions</option><option v-for="(l, v) in ACTIONS" :key="v" :value="v">{{ l }}</option></select>
        <select v-model="filtres.modele" class="champ" aria-label="Objet"><option value="">Tous les objets</option><option v-for="m in MODELES" :key="m">{{ m }}</option></select>
        <select v-model="filtres.acteurId" class="champ" aria-label="Utilisateur"><option value="">Tous les utilisateurs</option><option v-for="u in utilisateurs" :key="u.id" :value="u.id">{{ u.nom }}</option></select>
        <input v-model="filtres.du" type="date" class="champ" title="Du" aria-label="Du" />
        <input v-model="filtres.au" type="date" class="champ" title="Au" aria-label="Au" />
        <button class="bouton-principal"><i class="fa-solid fa-filter text-xs"></i> Filtrer</button>
    </form>
    <Chargement :chargement="chargement" :erreur="erreur" :vide="!journaux.length" message-vide="Aucune opération ne correspond aux filtres.">
        <section class="carte overflow-hidden">
            <ul class="divide-y divide-gray-100">
                <li v-for="j in journaux" :key="j.id" class="px-5 py-4 transition hover:bg-gray-50/60 sm:px-6">
                    <div class="flex flex-wrap justify-between gap-3">
                        <div class="flex min-w-0 gap-3.5">
                            <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ring-inset', style(j.action)]"><i :class="['fa-solid text-[13px]', icone(j.action)]"></i></span>
                            <div class="min-w-0">
                                <p class="text-sm font-semibold text-gray-900">{{ j.description }}</p>
                                <p class="mt-1 text-xs text-gray-400">
                                    <span class="font-medium text-gray-600">{{ j.acteur || 'Système' }}</span> · {{ j.creeLe?.toDate().toLocaleString('fr-FR') }} · {{ j.adresseIp || 'IP inconnue' }}<template v-if="j.operation"> · {{ j.operation }}</template>
                                </p>
                            </div>
                        </div>
                        <span v-if="j.modele" class="pastille h-fit bg-gray-50 font-mono text-[11px] text-gray-600 ring-gray-500/15">{{ j.modele }} #{{ j.modeleId }}</span>
                    </div>
                    <details v-if="j.avant || j.apres" class="group mt-3 ml-12">
                        <summary class="inline-flex items-center gap-1.5 text-xs font-semibold text-insec-600 hover:text-insec-800">
                            <i class="fa-solid fa-chevron-right text-[9px] transition group-open:rotate-90"></i> Voir les changements
                        </summary>
                        <div class="mt-2.5 grid gap-3 text-xs md:grid-cols-2">
                            <pre v-if="j.avant" class="overflow-x-auto rounded-xl bg-red-50/60 p-3.5 font-mono text-[11.5px] leading-5 whitespace-pre-wrap text-gray-700 ring-1 ring-red-100"><strong class="mb-1.5 block font-sans text-xs text-red-700">Avant</strong><template v-for="(v, k) in j.avant" :key="k"><span class="text-gray-400">{{ k }} :</span> <span class="break-all">{{ formaterValeur(v) }}</span>
</template></pre>
                            <pre v-if="j.apres" class="overflow-x-auto rounded-xl bg-emerald-50/60 p-3.5 font-mono text-[11.5px] leading-5 whitespace-pre-wrap text-gray-700 ring-1 ring-emerald-100"><strong class="mb-1.5 block font-sans text-xs text-emerald-700">Après</strong><template v-for="(v, k) in j.apres" :key="k"><span class="text-gray-400">{{ k }} :</span> <span class="break-all">{{ formaterValeur(v) }}</span>
</template></pre>
                        </div>
                    </details>
                </li>
            </ul>
        </section>
    </Chargement>
    <nav class="mt-5 flex items-center justify-between gap-3 text-sm text-gray-500" aria-label="Pagination">
        <button class="bouton-secondaire" :disabled="page <= 1 || chargement" @click="charger('precedente')"><i class="fa-solid fa-chevron-left text-xs"></i> Précédent</button>
        <span class="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 shadow-xs">Page {{ page }}</span>
        <button class="bouton-secondaire" :disabled="!suivante || chargement" @click="charger('suivante')">Suivant <i class="fa-solid fa-chevron-right text-xs"></i></button>
    </nav>
</template>
