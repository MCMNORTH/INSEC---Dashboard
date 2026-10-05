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
import type { Examen, ResultatHistorique } from '../../types';

interface ExamenOfficiel { codeUE: string; intitule: string; date: string; heure: string; diplome?: 'DGC' | 'DSGC'; diplôme?: 'DGC' | 'DSGC'; dateFr?: string; }
interface CalendrierImporte { annee: string; source: string; examens: ExamenOfficiel[]; }

const router = useRouter();
const { annees, annee, anneeCourante, ue, ues, formation } = useReferentiel();
const anneeId = ref('');
watch(anneeCourante, (a) => { if (!anneeId.value && a) anneeId.value = a.id; }, { immediate: true });
const page = ref(1);
const PAR_PAGE = 15;
const { donnees: resultatsBruts } = useRequete<ResultatHistorique>(() => collection(db, 'resultatsHistoriques'));
const resultats = computed(() => resultatsBruts.value.filter((r) => r.anneeId === (anneeId.value || '2024-2025')).sort((a, b) => a.codeUe.localeCompare(b.codeUe) || a.nomSource.localeCompare(b.nomSource)));
const fichierResultats = ref<File | null>(null);
const base64Resultats = ref('');
const apercuResultats = ref<{ total: number; ecarts: number; lignes: Omit<ResultatHistorique, 'id' | 'anneeId' | 'dateExamen' | 'source'>[] } | null>(null);
const chargementResultats = ref(false);
const erreurResultats = ref('');
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
    const diplome = (e as ExamenOfficiel).diplome ?? (e as ExamenOfficiel).diplôme ?? 'DGC';
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
const appreciationResultat = (r: Pick<ResultatHistorique, 'presence' | 'note'>) => {
    if (r.presence === 'Absent' || r.note === null) return 'Absent à l’épreuve';
    if (r.note >= 10) return 'UE validée';
    if (r.note >= 6) return 'UE capitalisable · non éliminatoire';
    return 'UE non validée · à repasser';
};

async function lireFichierResultats(event: Event) {
    fichierResultats.value = (event.target as HTMLInputElement).files?.[0] ?? null;
    apercuResultats.value = null;
    erreurResultats.value = '';
    if (!fichierResultats.value) { base64Resultats.value = ''; return; }
    if (!fichierResultats.value.name.toLocaleLowerCase().startsWith('resultat dcg-insec 2024-2025') || !fichierResultats.value.name.toLocaleLowerCase().endsWith('.xlsx')) {
        erreurResultats.value = 'Choisissez le classeur Excel « Resultat DCG-INSEC 2024-2025.xlsx » ; il fait foi pour les résultats.';
        base64Resultats.value = '';
        return;
    }
    if (fichierResultats.value.size > 6_000_000) { erreurResultats.value = 'Le classeur ne doit pas dépasser 6 Mo.'; base64Resultats.value = ''; return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Lecture du classeur impossible.'));
        reader.readAsDataURL(fichierResultats.value!);
    }).catch((e: Error) => { erreurResultats.value = e.message; return ''; });
    base64Resultats.value = dataUrl.split(',')[1] ?? '';
}

async function analyserClasseur() {
    if (!base64Resultats.value || !fichierResultats.value) return;
    chargementResultats.value = true; erreurResultats.value = '';
    try {
        apercuResultats.value = await appeler<typeof apercuResultats.value>('analyserResultatsHistoriques', { fichierBase64: base64Resultats.value, nomFichier: fichierResultats.value.name });
    } catch (e) { erreurResultats.value = messageErreur(e); }
    finally { chargementResultats.value = false; }
}

async function importerClasseur() {
    if (!apercuResultats.value || !base64Resultats.value || !fichierResultats.value) return;
    if (!window.confirm(`Importer ${apercuResultats.value.total} lignes de résultats depuis le classeur Excel de référence ? Les écarts seront conservés comme alertes ; aucune inscription ne sera créée. Une même importation remplace les lignes historiques correspondantes.`)) return;
    chargementResultats.value = true; erreurResultats.value = '';
    try {
        const resultat = await appeler<{ message: string }>('importerResultatsHistoriques', { fichierBase64: base64Resultats.value, nomFichier: fichierResultats.value.name });
        window.alert(resultat.message);
        apercuResultats.value = null;
    } catch (e) { erreurResultats.value = messageErreur(e); }
    finally { chargementResultats.value = false; }
}
</script>

<template>
    <div class="mb-5 flex flex-wrap justify-between gap-3">
        <div>
            <h1 class="text-xl font-bold text-insec">Examens & convocations</h1>
            <p class="text-sm text-gray-500">Calendrier officiel INTEC, candidats, convocations et retour des copies</p>
        </div>
        <div class="flex flex-wrap gap-2">
            <RouterLink to="/examens/importer-calendrier" class="bouton-secondaire">Importer un calendrier INTEC</RouterLink>
            
        </div>
    </div>
    <div v-if="erreurCalendrier" role="status" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Le calendrier enregistré n’a pas pu être chargé : {{ erreurCalendrier }}</div>
    <div class="carte mb-4 p-3">
        <select v-model="anneeId" class="champ w-auto" aria-label="Année académique">
            <option value="">Toutes les années</option>
            <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
        </select>
    </div>
    <section class="carte mb-5 p-5" aria-labelledby="resultats-historiques">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Historique · 2024–2025</p>
                <h2 id="resultats-historiques" class="mt-1 text-lg font-bold text-insec">Résultats du classeur INTEC</h2>
                <p class="mt-1 max-w-3xl text-sm text-gray-600">Le classeur Excel « Resultat DCG-INSEC 2024-2025.xlsx » est la source de référence, prioritaire sur les PDF d’engagement. Les notes et mentions ABS sont reproduites telles quelles ; les écarts d’identité ou d’UE sont signalés sans créer ni corriger d’inscription.</p>
            </div>
            <span class="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900">{{ resultats.length }} résultat(s) historique(s)</span>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <label class="etiquette">Classeur Excel de référence
                <input type="file" accept=".xlsx" class="champ mt-1" @change="lireFichierResultats" />
            </label>
            <button class="bouton-secondaire" :disabled="!base64Resultats || chargementResultats" @click="analyserClasseur">{{ chargementResultats ? 'Analyse…' : 'Analyser le classeur' }}</button>
            <button class="bouton-action" :disabled="!apercuResultats || chargementResultats" @click="importerClasseur">Importer les résultats</button>
        </div>
        <p v-if="erreurResultats" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{{ erreurResultats }}</p>
        <div v-if="apercuResultats" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p class="font-semibold text-amber-950">Aperçu : {{ apercuResultats.total }} résultat(s), {{ apercuResultats.ecarts }} écart(s) à vérifier.</p>
            <p class="mt-1 text-sm text-amber-900">Les lignes sont copiées du classeur. L’importation ne crée aucune inscription.</p>
            <div class="mt-3 max-h-80 overflow-auto rounded-lg bg-white">
                <table class="tableau">
                    <thead><tr><th>Candidat Excel</th><th>UE</th><th>Note source</th><th>Appréciation</th><th>Écart</th></tr></thead>
                    <tbody><tr v-for="(r, index) in apercuResultats.lignes" :key="`${r.nomSource}-${r.codeUe}-${index}`">
                        <td>{{ r.nomSource }}</td><td>{{ r.codeUe }} · {{ r.libelleUe }}</td><td>{{ r.noteSource }}</td><td>{{ appreciationResultat(r) }}</td>
                        <td><ul v-if="r.ecarts.length" class="list-disc pl-4 text-sm text-amber-900"><li v-for="e in r.ecarts" :key="e">{{ e }}</li></ul><span v-else class="text-green-700">Concordant</span></td>
                    </tr></tbody>
                </table>
            </div>
        </div>
        <div v-if="resultats.length" class="mt-4 overflow-x-auto">
            <table class="tableau">
                <thead><tr><th>Candidat (nom du classeur)</th><th>UE</th><th>Note source</th><th>Appréciation</th><th>Vérification annuaire / inscription</th></tr></thead>
                <tbody><tr v-for="r in resultats" :key="r.id" :class="r.ecarts.length ? 'bg-amber-50' : ''">
                    <td>{{ r.nomSource }}</td><td>{{ r.codeUe }} · {{ r.libelleUe }}</td><td>{{ r.noteSource }}</td><td>{{ appreciationResultat(r) }}</td>
                    <td><span v-if="!r.ecarts.length" class="text-green-700">Concordant</span><ul v-else class="list-disc pl-4 text-sm text-amber-900"><li v-for="e in r.ecarts" :key="e">{{ e }}</li></ul></td>
                </tr></tbody>
            </table>
        </div>
    </section>
    <section class="carte mb-5 overflow-hidden">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">Source officielle INTEC</p>
                <h2 class="mt-1 text-lg font-bold text-insec">Épreuves DGC et DSGC · {{ anneeCalendrierIntec || 'aucune année' }}</h2>
                <p v-if="calendrierOfficiel" class="mt-1 text-sm text-gray-600">{{ calendrierIntec.length }} épreuves écrites, horaires de Paris. Les dates et horaires sont ceux publiés par l’INTEC. L’INSEC peut ouvrir un suivi local pour gérer les candidats, la salle et les convocations.</p>
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
                    <thead><tr><th>Date et heure (Paris)</th><th>Diplôme / UE INTEC</th><th>UE locale</th><th>Suivi INSEC</th></tr></thead>
                    <tbody>
                        <tr v-for="e in calendrierIntec" :key="e.codeUE">
                            <td><strong>{{ e.dateFr }}</strong><br /><span class="text-gray-500">{{ e.heure }} (Paris)</span></td>
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
                                >Suivre l’épreuve</RouterLink>
                                <span v-else class="text-sm text-gray-400">Indisponible</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="border-t border-gray-100 bg-amber-50/60 px-5 py-3 text-sm text-amber-950">
                Les dates individuelles des soutenances sont communiquées séparément par l’INTEC. Les informations du calendrier restent sous la responsabilité de l’INTEC ; le suivi local ne permet pas de modifier leur date ou leur horaire.
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
                        <td>{{ e.statut === 'Planifié' ? 'À venir · calendrier INTEC' : e.statut }}</td>
                    </tr>
                    <tr v-if="!examens.length">
                        <td colspan="6" class="p-0">
                            <div class="flex flex-col items-center px-6 py-10 text-center">
                                <i class="fa-solid fa-calendar-check mb-4 text-2xl text-insec" aria-hidden="true"></i>
                                <h2 class="font-semibold text-gray-800">{{ anneeId ? 'Aucun examen pour cette année scolaire' : 'Aucun suivi local n’est encore ouvert' }}</h2>
                                <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                                    Ouvrez le suivi d’une épreuve du calendrier officiel pour gérer les candidats, les convocations, la réception des sujets, la salle et le retour des copies à l’INTEC.
                                </p>
                                <RouterLink to="/examens/importer-calendrier" class="bouton-action mt-5">Consulter le calendrier INTEC</RouterLink>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="examens.length" :par-page="PAR_PAGE" />
    </Chargement>
</template>
