<script setup lang="ts">
import { ref, watch } from 'vue';
import { appeler, messageErreur } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { montant } from '../../format';

interface Tableau {
    annees: { id: string; libelle: string }[];
    anneeId: string | null;
    montantEnRetard: number;
    resteARecouvrer: number;
    impayes: { inscriptionId: string; etudiantId: string; etudiant: string; formation: string; solde: number; retard: number }[];
    examensProchains: { id: string; ue: string; dateExamen: string; salle: string | null }[];
    totalEtudiants: number;
    inscriptionsActives: number;
}

const anneeId = ref<string | null>(null);
const tableau = ref<Tableau | null>(null);
const chargement = ref(true);
const erreur = ref('');

async function charger() {
    chargement.value = true;
    erreur.value = '';
    try {
        tableau.value = await appeler<Tableau>('tableauDeBordAdmin', { anneeId: anneeId.value });
        anneeId.value = tableau.value.anneeId;
    } catch (e) {
        erreur.value = messageErreur(e);
    } finally {
        chargement.value = false;
    }
}

watch(anneeId, (nouvelle, ancienne) => {
    if (ancienne !== null && nouvelle !== ancienne) void charger();
});
void charger();

function libelleAnnee(t: Tableau): string {
    return t.annees.find((a) => a.id === t.anneeId)?.libelle ?? 'Année sélectionnée';
}

function dateParis(valeur: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Europe/Paris',
    }).format(new Date(valeur));
}

function heureParis(valeur: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
    }).format(new Date(valeur));
}

const cartes = (t: Tableau) => [
    {
        libelle: 'Inscriptions confirmées',
        valeur: t.inscriptionsActives,
        detail: 'Pour l’année scolaire ' + libelleAnnee(t),
        icone: 'fa-id-card',
        fond: 'bg-indigo-50',
        accent: 'text-insec',
    },
    {
        libelle: 'Étudiants au registre',
        valeur: t.totalEtudiants,
        detail: 'Tous les dossiers conservés',
        icone: 'fa-users',
        fond: 'bg-blue-50',
        accent: 'text-blue-700',
    },
    {
        libelle: 'Examens à préparer',
        valeur: t.examensProchains.length,
        detail: 'Dans les 30 prochains jours',
        icone: 'fa-calendar-days',
        fond: 'bg-amber-50',
        accent: 'text-amber-700',
    },
    {
        libelle: 'Reste à recouvrer',
        valeur: montant(t.resteARecouvrer) + ' MRU',
        detail: 'Sur l’année scolaire sélectionnée',
        icone: 'fa-wallet',
        fond: 'bg-emerald-50',
        accent: 'text-emerald-700',
    },
] as const;
</script>

<template>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
            <p class="text-sm font-medium text-insec">Pilotage INSEC</p>
            <h1 class="titre-page">Suivi de l’année scolaire</h1>
            <p class="mt-1 text-sm text-gray-500">Inscriptions confirmées, étudiants au registre et examens à venir.</p>
        </div>
        <label class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span class="text-sm text-gray-500">Année scolaire</span>
            <select v-model="anneeId" class="border-0 py-1 pr-8 text-sm font-semibold text-insec focus:ring-0">
                <option v-for="a in tableau?.annees ?? []" :key="a.id" :value="a.id">{{ a.libelle }}</option>
            </select>
        </label>
    </div>

    <Chargement :chargement="chargement && !tableau" :erreur="erreur">
        <template v-if="tableau">
            <section class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" :class="{ 'opacity-60': chargement }">
                <article v-for="carte in cartes(tableau)" :key="carte.libelle" :class="[carte.fond, 'rounded-2xl border border-white p-5 shadow-sm']">
                    <div class="mb-4 flex items-center justify-between">
                        <p class="text-sm font-medium text-gray-600">{{ carte.libelle }}</p>
                        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80">
                            <i :class="['fa-solid', carte.icone, carte.accent]"></i>
                        </span>
                    </div>
                    <p :class="['text-2xl font-bold tracking-tight', carte.accent]">{{ carte.valeur }}</p>
                    <p class="mt-2 text-xs text-gray-500">{{ carte.detail }}</p>
                </article>
            </section>

            <div v-if="tableau.montantEnRetard > 0" class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <span><i class="fa-solid fa-triangle-exclamation mr-2"></i><strong>{{ montant(tableau.montantEnRetard) }} MRU</strong> de paiements sont en retard.</span>
                <RouterLink to="/finances" class="text-sm font-semibold hover:underline">Consulter les finances <i class="fa-solid fa-arrow-right ml-1"></i></RouterLink>
            </div>

            <section class="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <article class="overflow-hidden rounded-2xl border border-gray-200 bg-white xl:col-span-2">
                    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <div>
                            <h2 class="font-bold text-insec">Prochains examens</h2>
                            <p class="mt-1 text-xs text-gray-500">Sessions planifiées dans les 30 prochains jours · heures de Paris</p>
                        </div>
                        <RouterLink to="/examens" class="text-sm font-semibold text-insec hover:underline">Voir les examens <i class="fa-solid fa-arrow-right ml-1"></i></RouterLink>
                    </header>
                    <div v-if="tableau.examensProchains.length" class="divide-y divide-gray-100">
                        <RouterLink v-for="e in tableau.examensProchains" :key="e.id" :to="`/examens/${e.id}`" class="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50">
                            <span class="flex min-w-16 flex-col items-center rounded-xl bg-amber-50 px-3 py-2 text-center text-amber-800">
                                <span class="text-[11px] font-semibold uppercase">{{ dateParis(e.dateExamen).split(' ')[1] }}</span>
                                <span class="text-lg font-bold leading-5">{{ dateParis(e.dateExamen).split(' ')[0] }}</span>
                            </span>
                            <span class="min-w-0 flex-1">
                                <strong class="block truncate text-sm text-gray-900">{{ e.ue }}</strong>
                                <span class="mt-1 block text-xs text-gray-500">{{ heureParis(e.dateExamen) }} · {{ e.salle || 'Salle à définir' }}</span>
                            </span>
                            <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
                        </RouterLink>
                    </div>
                    <div v-else class="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                        <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                            <i class="fa-regular fa-calendar"></i>
                        </span>
                        <p class="font-semibold text-gray-800">Aucun examen proche</p>
                        <p class="mt-1 max-w-sm text-sm text-gray-500">Les examens prévus dans les 30 prochains jours apparaîtront ici.</p>
                    </div>
                </article>

                <article class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <header class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <div>
                            <h2 class="font-bold text-insec">Suivi des paiements</h2>
                            <p class="mt-1 text-xs text-gray-500">Soldes à traiter pour l’année choisie</p>
                        </div>
                        <RouterLink to="/finances" aria-label="Ouvrir les finances" class="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-insec hover:bg-gray-100">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </RouterLink>
                    </header>
                    <div v-if="tableau.impayes.length" class="divide-y divide-gray-100">
                        <RouterLink v-for="i in tableau.impayes" :key="i.inscriptionId" :to="{ path: '/finances', query: { etudiant: i.etudiantId, inscription: i.inscriptionId } }" class="block px-5 py-4 transition hover:bg-gray-50">
                            <div class="flex items-start justify-between gap-3">
                                <span class="min-w-0">
                                    <strong class="block truncate text-sm text-gray-900">{{ i.etudiant }}</strong>
                                    <span class="mt-1 block text-xs text-gray-500">{{ i.formation }}</span>
                                </span>
                                <strong class="shrink-0 text-sm text-insec">{{ montant(i.solde) }} MRU</strong>
                            </div>
                            <span :class="['mt-2 block text-xs', i.retard > 0 ? 'text-red-600' : 'text-gray-500']">
                                {{ i.retard > 0 ? 'Retard : ' + montant(i.retard) + ' MRU' : 'Paiement à suivre' }}
                            </span>
                        </RouterLink>
                    </div>
                    <div v-else class="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                        <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                            <i class="fa-solid fa-circle-check"></i>
                        </span>
                        <p class="font-semibold text-gray-800">Aucun solde à suivre</p>
                        <p class="mt-1 text-sm text-gray-500">Les paiements en attente apparaîtront ici.</p>
                    </div>
                </article>
            </section>
        </template>
    </Chargement>
</template>
