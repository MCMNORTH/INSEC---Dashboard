<script setup lang="ts">
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, onMounted, ref, watch } from 'vue';
import { appeler, messageErreur } from '../../api';
import { useRouter } from 'vue-router';
import Chargement from '../../composants/Chargement.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { dateHeureParis } from '../../format';
import { CALENDRIERS_INTEC } from '../../calendrierIntec';
import { useReferentiel } from '../../referentiel';
import type { Examen } from '../../types';

interface ExamenOfficiel { codeUE: string; intitule: string; date: string; heure: string; diplome?: 'DGC' | 'DSGC'; diplôme?: 'DGC' | 'DSGC'; dateFr?: string; }
interface CalendrierImporte { annee: string; source: string; examens: ExamenOfficiel[]; }

const router = useRouter();
const { annees, annee, ue, ues, formation } = useReferentiel();
const anneeId = ref('');
const page = ref(1);
const PAR_PAGE = 15;
const calendriersImportes = ref<CalendrierImporte[]>([]);
const erreurCalendrier = ref('');
const { donnees: examens, chargement, erreur } = useRequete<Examen>(() =>
    anneeId.value
        ? query(collection(db, 'examens'), where('anneeId', '==', anneeId.value), orderBy('dateExamen', 'desc'))
        : query(collection(db, 'examens'), orderBy('dateExamen', 'desc')),
);
onMounted(async () => {
    try {
        const resultat = await appeler<{ calendriers: CalendrierImporte[] }>('lireCalendriersIntec');
        calendriersImportes.value = resultat.calendriers;
    } catch (e) {
        erreurCalendrier.value = messageErreur(e);
    }
});
watch(anneeId, () => (page.value = 1));
const affiches = computed(() => examens.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE));
const toutesAnneesCalendrier = computed(() => [
    ...new Set([...Object.keys(CALENDRIERS_INTEC), ...calendriersImportes.value.map((c) => c.annee)]),
].sort().reverse());
const anneeCalendrierIntec = computed(() => anneeId.value ? annee(anneeId.value)?.libelle ?? '' : toutesAnneesCalendrier.value[0] ?? '');
const calendrierOfficiel = computed(() =>
    calendriersImportes.value.find((c) => c.annee === anneeCalendrierIntec.value)
    ?? CALENDRIERS_INTEC[anneeCalendrierIntec.value as keyof typeof CALENDRIERS_INTEC]
    ?? null,
);
const calendrierIntec = computed(() => (calendrierOfficiel.value?.examens ?? []).map((e) => {
    const diplome = e.diplome ?? e.diplôme ?? 'DGC';
    const date = e.date;
    const dateFr = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(`${date}T12:00:00+01:00`));
    return {
        ...e,
        diplôme: diplome,
        dateFr: e.dateFr ?? dateFr,
        ue: ues.value.find((u) => u.code === `TEC${e.codeUE}` && formation(u.formationId)?.code === diplome),
        dateHeure: `${date}T${e.heure}`,
    };
}));
</script>

<template>
    <div class="mb-5 flex flex-wrap justify-between gap-3">
        <div>
            <h1 class="text-xl font-bold text-insec">Examens & convocations</h1>
            <p class="text-sm text-gray-500">Préparation des épreuves, convocations et retour des copies à l’INTEC</p>
        </div>
        <div class="flex flex-wrap gap-2">
            <RouterLink to="/examens/importer-calendrier" class="bouton-secondaire">Importer un calendrier INTEC</RouterLink>
            <RouterLink to="/examens/nouveau" class="bouton-action">+ Planifier un examen</RouterLink>
        </div>
    </div>
    <div v-if="erreurCalendrier" role="status" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Le calendrier enregistré n’a pas pu être chargé : {{ erreurCalendrier }}</div>
    <div class="carte mb-4 p-3">
        <select v-model="anneeId" class="champ w-auto" aria-label="Année académique">
            <option value="">Toutes les années</option>
            <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
        </select>
    </div>
    <section class="carte mb-5 overflow-hidden">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Source officielle INTEC</p>
                <h2 class="mt-1 text-lg font-bold text-insec">Épreuves DGC et DSGC · {{ anneeCalendrierIntec || 'aucune année' }}</h2>
                <p v-if="calendrierOfficiel" class="mt-1 text-sm text-gray-600">{{ calendrierIntec.length }} épreuves écrites, horaires de Paris. Choisissez une épreuve pour ouvrir sa planification locale préremplie.</p>
            </div>
            <a v-if="calendrierOfficiel" :href="calendrierOfficiel.source" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Consulter le document INTEC ↗</a>
            <a v-else href="https://intec.cnam.fr/planning-des-examens--1559071.kjsp" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Vérifier les publications INTEC ↗</a>
        </header>
        <div v-if="!calendrierOfficiel" class="px-5 py-5">
            <p class="font-semibold text-gray-800">Aucun calendrier {{ anneeCalendrierIntec }} n’est intégré dans l’application.</p>
            <p class="mt-1 text-sm text-gray-600">Consultez la page officielle de l’INTEC pour vérifier si les dates de cette année ont été publiées.</p>
        </div>
        <div v-else>
            <div class="overflow-x-auto">
                <table class="tableau">
                    <thead><tr><th>Date et heure (Paris)</th><th>Diplôme / UE INTEC</th><th>UE locale</th><th>Planification</th></tr></thead>
                    <tbody>
                        <tr v-for="e in calendrierIntec" :key="e.codeUE">
                            <td><strong>{{ e.dateFr }}</strong><br /><span class="text-gray-500">{{ e.heure }}</span></td>
                            <td><span class="font-semibold">{{ e.diplôme }} · {{ e.codeUE }}</span><br /><span class="text-gray-500">{{ e.intitule }}</span></td>
                            <td>
                                <span v-if="e.ue" class="font-medium">{{ e.ue.code }} · {{ e.ue.libelle }}</span>
                                <span v-else class="text-amber-700">UE non trouvée dans le référentiel local</span>
                            </td>
                            <td>
                                <RouterLink
                                    v-if="e.ue && anneeCalendrierIntec"
                                    :to="{ path: '/examens/nouveau', query: { source: 'intec', ue: e.codeUE, annee: anneeCalendrierIntec, dateHeure: e.dateHeure, session: 'Normale' } }"
                                    class="bouton-secondaire whitespace-nowrap"
                                >Préparer</RouterLink>
                                <span v-else class="text-sm text-gray-400">Indisponible</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="border-t border-gray-100 bg-amber-50/60 px-5 py-3 text-sm text-amber-950">
                Les dates individuelles des soutenances sont communiquées séparément par l’INTEC et ne sont pas ajoutées comme épreuves datées.
                Vérifiez la page officielle avant chaque planification : le calendrier peut évoluer.
            </div>
        </div>
    </section>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl bg-white shadow">
            <table class="tableau">
                <thead><tr><th>Date et heure (Paris)</th><th>Diplôme / UE</th><th>Session</th><th>Salle</th><th>Convoqués</th><th>Statut</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer hover:bg-gray-50" @click="router.push(`/examens/${e.id}`)">
                        <td>{{ dateHeureParis(e.dateExamen) }}</td>
                        <td><strong>{{ formation(e.formationId)?.code }} · {{ ue(e.ueId)?.code }}</strong><br /><span class="text-gray-500">{{ ue(e.ueId)?.libelle }}</span></td>
                        <td>{{ e.session }}<br /><span class="text-xs text-gray-500">{{ annee(e.anneeId)?.libelle }}</span></td>
                        <td>{{ e.salle || '—' }}</td>
                        <td>{{ e.nbConvoques }}</td>
                        <td>{{ e.statut }}</td>
                    </tr>
                    <tr v-if="!examens.length">
                        <td colspan="6" class="p-0">
                            <div class="flex flex-col items-center px-6 py-10 text-center">
                                <i class="fa-solid fa-calendar-check mb-4 text-2xl text-insec" aria-hidden="true"></i>
                                <h2 class="font-semibold text-gray-800">{{ anneeId ? 'Aucun examen pour cette année scolaire' : 'Aucune session planifiée' }}</h2>
                                <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                                    Après la planification, la fiche de chaque épreuve permet de suivre la réception des sujets,
                                    la confirmation de la salle et de la surveillance, puis le retour des copies à l’INTEC.
                                </p>
                                <RouterLink to="/examens/nouveau" class="bouton-action mt-5">+ Planifier un examen</RouterLink>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="examens.length" :par-page="PAR_PAGE" />
    </Chargement>
</template>
