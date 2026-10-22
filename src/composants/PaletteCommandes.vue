<script setup lang="ts">
import { ROLES_ADMIN } from '@shared/domaine';
import { collection, orderBy, query } from 'firebase/firestore';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { NAVIGATION, PAGES_SECONDAIRES } from '../navigation';
import { aRole } from '../session';
import type { Etudiant } from '../types';

// Recherche rapide (Ctrl+K) : pages du logiciel et, pour l'administration, dossiers étudiants.
const ouverte = defineModel<boolean>({ required: true });
const router = useRouter();
const terme = ref('');
const actif = ref(0);
const champ = ref<HTMLInputElement | null>(null);
const liste = ref<HTMLElement | null>(null);

const dejaOuverte = ref(false);
watch(ouverte, async (valeur) => {
    if (!valeur) return;
    dejaOuverte.value = true;
    terme.value = '';
    actif.value = 0;
    await nextTick();
    champ.value?.focus();
});
const { donnees: etudiants } = useRequete<Etudiant>(() =>
    dejaOuverte.value && aRole(...ROLES_ADMIN) ? query(collection(db, 'etudiants'), orderBy('nom')) : null,
);

const normaliser = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

interface Resultat {
    cle: string;
    groupe: string;
    icone: string;
    libelle: string;
    description: string;
    vers: string;
}

const resultats = computed<Resultat[]>(() => {
    const t = normaliser(terme.value.trim());
    const pages = [...NAVIGATION.flatMap((g) => g.entrees), ...PAGES_SECONDAIRES]
        .filter((p) => aRole(...p.roles))
        .filter((p) => !t || normaliser(`${p.libelle} ${p.description}`).includes(t))
        .map((p) => ({ cle: p.vers, groupe: 'Pages', icone: p.icone, libelle: p.libelle, description: p.description, vers: p.vers }));
    const personnes = !t ? [] : etudiants.value
        .filter((e) => normaliser(`${e.nom} ${e.prenom} ${e.prenom} ${e.nom} ${e.email ?? ''}`).includes(t))
        .slice(0, 8)
        .map((e) => ({
            cle: e.id, groupe: 'Étudiants', icone: 'fa-user', libelle: `${e.prenom} ${e.nom}`,
            description: e.email || 'Dossier étudiant', vers: `/etudiants/${e.id}`,
        }));
    return [...personnes, ...pages];
});
watch(terme, () => (actif.value = 0));

const groupes = computed(() => {
    const parGroupe = new Map<string, (Resultat & { index: number })[]>();
    resultats.value.forEach((r, index) => parGroupe.set(r.groupe, [...(parGroupe.get(r.groupe) ?? []), { ...r, index }]));
    return [...parGroupe.entries()];
});

function aller(r: Resultat | undefined) {
    if (!r) return;
    ouverte.value = false;
    void router.push(r.vers);
}

async function deplacer(pas: number) {
    const total = resultats.value.length;
    if (!total) return;
    actif.value = (actif.value + pas + total) % total;
    await nextTick();
    liste.value?.querySelector(`[data-index="${actif.value}"]`)?.scrollIntoView({ block: 'nearest' });
}

function raccourci(evenement: KeyboardEvent) {
    if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault();
        ouverte.value = !ouverte.value;
    }
}
onMounted(() => document.addEventListener('keydown', raccourci));
onBeforeUnmount(() => document.removeEventListener('keydown', raccourci));
</script>

<template>
    <Teleport to="body">
        <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-150" leave-active-class="transition duration-100">
            <div v-if="ouverte" class="fixed inset-0 z-[60] flex items-start justify-center bg-insec-950/40 p-4 pt-[12vh] backdrop-blur-sm" @mousedown.self="ouverte = false">
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Recherche rapide"
                    class="w-full max-w-xl animate-surgir overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_64px_-12px_rgb(18_23_53/0.35)]"
                    @keydown.esc="ouverte = false"
                    @keydown.down.prevent="deplacer(1)"
                    @keydown.up.prevent="deplacer(-1)"
                    @keydown.enter.prevent="aller(resultats[actif])"
                >
                    <div class="flex items-center gap-3 border-b border-gray-100 px-5">
                        <i class="fa-solid fa-magnifying-glass text-gray-400"></i>
                        <input
                            ref="champ"
                            v-model="terme"
                            type="text"
                            class="h-14 w-full border-0 bg-transparent p-0 text-[15px] text-gray-900 placeholder:text-gray-400 focus:ring-0"
                            placeholder="Rechercher une page ou un étudiant…"
                            aria-label="Rechercher"
                            autocomplete="off"
                        />
                        <kbd class="hidden rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-[11px] text-gray-500 sm:block">Échap</kbd>
                    </div>
                    <div ref="liste" class="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                        <template v-for="[groupe, elements] in groupes" :key="groupe">
                            <p class="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase">{{ groupe }}</p>
                            <button
                                v-for="r in elements"
                                :key="r.cle"
                                type="button"
                                :data-index="r.index"
                                :class="['flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', r.index === actif ? 'bg-insec-50' : 'hover:bg-gray-50']"
                                @mousemove="actif = r.index"
                                @click="aller(r)"
                            >
                                <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition', r.index === actif ? 'bg-insec-900 text-white ring-insec-900' : 'bg-white text-gray-500 ring-gray-200']">
                                    <i :class="['fa-solid text-sm', r.icone]"></i>
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-sm font-semibold text-gray-900">{{ r.libelle }}</span>
                                    <span class="block truncate text-xs text-gray-500">{{ r.description }}</span>
                                </span>
                                <i v-if="r.index === actif" class="fa-solid fa-arrow-turn-down rotate-90 text-xs text-insec-400"></i>
                            </button>
                        </template>
                        <div v-if="!resultats.length" class="px-4 py-10 text-center">
                            <i class="fa-regular fa-face-meh-blank text-2xl text-gray-300"></i>
                            <p class="mt-2 text-sm text-gray-500">Aucun résultat pour « {{ terme }} ».</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 border-t border-gray-100 bg-gray-50/70 px-5 py-2.5 text-[11px] text-gray-500">
                        <span><kbd class="touche">↑</kbd> <kbd class="touche">↓</kbd> naviguer</span>
                        <span><kbd class="touche">Entrée</kbd> ouvrir</span>
                        <span class="ml-auto"><kbd class="touche">Ctrl</kbd> <kbd class="touche">K</kbd> à tout moment</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.touche {
    display: inline-block;
    min-width: 1.25rem;
    border: 1px solid var(--color-gray-200);
    border-radius: 0.35rem;
    background: white;
    padding: 0 0.3rem;
    text-align: center;
    font-family: inherit;
    font-size: 10.5px;
    color: var(--color-gray-600);
}
</style>
