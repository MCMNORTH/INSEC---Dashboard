<script setup lang="ts">
import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip } from 'chart.js';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { appeler, messageErreur } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { dateHeure, heure, montant } from '../../format';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Legend, Tooltip);

interface Tableau {
    annees: { id: string; libelle: string }[];
    anneeId: string | null;
    montantFacture: number;
    encaisses: number;
    resteARecouvrer: number;
    montantEnRetard: number;
    tauxRecouvrement: number;
    tauxReussite: number;
    performanceDiplomes: { code: string; inscrits: number; notes: number; valides: number; taux: number }[];
    performanceUes: { code: string; libelle: string; notes: number; moyenne: number; taux: number }[];
    impayes: { inscriptionId: string; etudiantId: string; etudiant: string; formation: string; solde: number; retard: number }[];
    examensProchains: { id: string; ue: string; dateExamen: string; salle: string | null }[];
    paiements12: number[];
    repartition: Record<string, number>;
    etudiantsActifs: number;
    inscriptionsActives: number;
}

const anneeId = ref<string | null>(null);
const tableau = ref<Tableau | null>(null);
const chargement = ref(true);
const erreur = ref('');
const canevasPaiements = ref<HTMLCanvasElement>();
const canevasStatuts = ref<HTMLCanvasElement>();
let graphiques: Chart[] = [];
const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

async function charger() {
    chargement.value = true;
    erreur.value = '';
    try {
        tableau.value = await appeler<Tableau>('tableauDeBordAdmin', { anneeId: anneeId.value });
        anneeId.value = tableau.value.anneeId;
        chargement.value = false;
        await nextTick();
        dessiner();
    } catch (e) {
        erreur.value = messageErreur(e);
        chargement.value = false;
    }
}

function dessiner() {
    graphiques.forEach((g) => g.destroy());
    graphiques = [];
    const t = tableau.value;
    if (!t || !canevasPaiements.value || !canevasStatuts.value) return;
    graphiques.push(new Chart(canevasPaiements.value, {
        type: 'bar',
        data: { labels: MOIS, datasets: [{ data: t.paiements12, backgroundColor: '#1E2761', borderRadius: 5, maxBarThickness: 34 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } },
    }));
    const statuts = ['Actif', 'Suspendu', 'Diplômé', 'Abandon'];
    graphiques.push(new Chart(canevasStatuts.value, {
        type: 'doughnut',
        data: { labels: statuts, datasets: [{ data: statuts.map((s) => t.repartition[s] ?? 0), backgroundColor: ['#16a34a', '#d97706', '#2563eb', '#dc2626'], borderWidth: 0 }] },
        options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } } },
    }));
}

watch(anneeId, (nouvelle, ancienne) => {
    if (ancienne !== null && nouvelle !== ancienne) void charger();
});
void charger();
onBeforeUnmount(() => graphiques.forEach((g) => g.destroy()));

const cartes = (t: Tableau) => [
    ['Étudiants actifs', t.etudiantsActifs, 'fa-users', 'bg-blue-50'],
    ['Inscriptions actives', t.inscriptionsActives, 'fa-id-card', 'bg-indigo-50'],
    ['Encaissé', `${montant(t.encaisses)} MRU`, 'fa-money-bill-wave', 'bg-emerald-50'],
    ['À recouvrer', `${montant(t.resteARecouvrer)} MRU`, 'fa-wallet', 'bg-amber-50'],
    ['Taux recouvrement', `${t.tauxRecouvrement} %`, 'fa-chart-line', 'bg-cyan-50'],
    ['Taux de réussite', `${t.tauxReussite} %`, 'fa-graduation-cap', 'bg-purple-50'],
] as const;
</script>

<template>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
            <p class="text-sm text-gray-500">Pilotage INSEC</p>
            <h1 class="titre-page">Tableau de bord décisionnel</h1>
        </div>
        <label class="flex items-center gap-2 rounded-lg border bg-white p-2">
            <span class="pl-2 text-sm text-gray-500">Année</span>
            <select v-model="anneeId" class="border-0 py-1 pr-8 text-sm font-semibold focus:ring-0">
                <option v-for="a in tableau?.annees ?? []" :key="a.id" :value="a.id">{{ a.libelle }}</option>
            </select>
        </label>
    </div>

    <Chargement :chargement="chargement && !tableau" :erreur="erreur">
        <template v-if="tableau">
            <section class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6" :class="{ 'opacity-60': chargement }">
                <article v-for="[libelle, valeur, icone, fond] in cartes(tableau)" :key="libelle" :class="[fond, 'rounded-xl border border-white p-4 shadow-sm']">
                    <i :class="['fa-solid mb-3 text-insec', icone]"></i>
                    <p class="text-xl font-bold text-insec">{{ valeur }}</p>
                    <p class="mt-1 text-xs text-gray-500">{{ libelle }}</p>
                </article>
            </section>

            <div v-if="tableau.montantEnRetard > 0" class="mb-6 flex justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <span><i class="fa-solid fa-triangle-exclamation mr-2"></i><strong>{{ montant(tableau.montantEnRetard) }} MRU</strong> actuellement en retard.</span>
                <RouterLink to="/finances" class="text-sm font-semibold">Traiter →</RouterLink>
            </div>

            <section class="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
                <article class="rounded-xl border bg-white p-5 xl:col-span-2">
                    <div class="mb-4 flex justify-between"><h2 class="font-bold text-insec">Encaissements mensuels</h2><span class="text-xs text-gray-400">{{ new Date().getFullYear() }}</span></div>
                    <canvas ref="canevasPaiements" height="90" aria-label="Encaissements mensuels" role="img"></canvas>
                </article>
                <article class="rounded-xl border bg-white p-5">
                    <h2 class="mb-4 font-bold text-insec">Situation des étudiants</h2>
                    <canvas ref="canevasStatuts" height="190" aria-label="Répartition des étudiants par statut" role="img"></canvas>
                </article>
            </section>

            <section class="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <article class="overflow-hidden rounded-xl border bg-white">
                    <header class="border-b p-5"><h2 class="font-bold text-insec">Performance par diplôme</h2></header>
                    <div class="space-y-5 p-5">
                        <div v-for="l in tableau.performanceDiplomes" :key="l.code">
                            <div class="mb-2 flex justify-between text-sm"><span><strong>{{ l.code }}</strong> · {{ l.inscrits }} étudiant(s)</span><span class="font-bold">{{ l.taux }} %</span></div>
                            <div class="h-2 rounded-full bg-gray-100"><div class="h-2 rounded-full bg-insec" :style="{ width: `${Math.min(l.taux, 100)}%` }"></div></div>
                            <p class="mt-1 text-xs text-gray-400">{{ l.valides }} UE validée(s) sur {{ l.notes }} résultat(s)</p>
                        </div>
                        <p v-if="!tableau.performanceDiplomes.length" class="text-sm text-gray-500">Aucun résultat publié.</p>
                    </div>
                </article>
                <article class="overflow-hidden rounded-xl border bg-white">
                    <header class="border-b p-5"><h2 class="font-bold text-insec">Réussite par UE</h2></header>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-gray-500"><tr><th class="p-3 text-left">UE</th><th class="p-3 text-right">Moyenne</th><th class="p-3 text-right">Réussite</th></tr></thead>
                            <tbody>
                                <tr v-for="ue in tableau.performanceUes" :key="ue.code" class="border-t">
                                    <td class="p-3"><strong>{{ ue.code }}</strong><span class="block max-w-xs truncate text-xs text-gray-400">{{ ue.libelle }}</span></td>
                                    <td class="p-3 text-right">{{ ue.moyenne }}/20</td>
                                    <td :class="['p-3 text-right font-semibold', ue.taux >= 50 ? 'text-green-600' : 'text-red-600']">{{ ue.taux }} %</td>
                                </tr>
                                <tr v-if="!tableau.performanceUes.length"><td colspan="3" class="p-6 text-center text-gray-400">Aucune note disponible.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </article>
            </section>

            <section class="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <article class="overflow-hidden rounded-xl border bg-white xl:col-span-2">
                    <header class="flex justify-between border-b p-5"><h2 class="font-bold text-insec">Dossiers financiers à suivre</h2><RouterLink to="/finances" class="text-sm font-semibold">Voir tout</RouterLink></header>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-gray-500"><tr><th class="p-3 text-left">Étudiant</th><th class="p-3 text-left">Diplôme</th><th class="p-3 text-right">Reste</th><th class="p-3 text-right">Retard</th></tr></thead>
                            <tbody>
                                <tr v-for="i in tableau.impayes" :key="i.inscriptionId" class="border-t">
                                    <td class="p-3 font-medium"><RouterLink :to="{ path: '/finances', query: { etudiant: i.etudiantId, inscription: i.inscriptionId } }" class="hover:underline">{{ i.etudiant }}</RouterLink></td>
                                    <td class="p-3">{{ i.formation }}</td>
                                    <td class="p-3 text-right">{{ montant(i.solde) }}</td>
                                    <td :class="['p-3 text-right font-semibold', i.retard > 0 ? 'text-red-600' : 'text-gray-400']">{{ montant(i.retard) }}</td>
                                </tr>
                                <tr v-if="!tableau.impayes.length"><td colspan="4" class="p-6 text-center text-gray-400">Aucun solde restant.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </article>
                <article class="rounded-xl border bg-white">
                    <header class="border-b p-5"><h2 class="font-bold text-insec">Examens dans les 30 jours</h2></header>
                    <div class="divide-y">
                        <RouterLink v-for="e in tableau.examensProchains" :key="e.id" :to="`/examens/${e.id}`" class="block p-4 hover:bg-gray-50">
                            <div class="flex justify-between"><strong class="text-sm">{{ e.ue }}</strong><span class="text-xs text-gray-400">{{ dateHeure(e.dateExamen).slice(0, 5) }}</span></div>
                            <p class="mt-1 text-xs text-gray-500">{{ heure(e.dateExamen) }} · {{ e.salle || 'Salle à définir' }}</p>
                        </RouterLink>
                        <p v-if="!tableau.examensProchains.length" class="p-6 text-center text-sm text-gray-400">Aucun examen proche.</p>
                    </div>
                </article>
            </section>
        </template>
    </Chargement>
</template>
