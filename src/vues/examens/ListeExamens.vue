<script setup lang="ts">
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, onMounted, ref, watch } from 'vue';
import { appeler, messageErreur } from '../../api';
import { useRouter } from 'vue-router';
import Chargement from '../../composants/Chargement.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { heureNouakchottDepuisParis, horaireExamen } from '../../format';
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
const resultats = computed(() => resultatsBruts.value.filter((r) => r.anneeId === anneeId.value).sort((a, b) => a.codeUe.localeCompare(b.codeUe) || a.nomSource.localeCompare(b.nomSource)));
const fichierResultats = ref<File | null>(null);
const base64Resultats = ref('');
const apercuResultats = ref<{ total: number; ecarts: number; lignes: Omit<ResultatHistorique, 'id' | 'anneeId' | 'dateExamen' | 'source'>[] } | null>(null);
const chargementResultats = ref(false);
const erreurResultats = ref('');
const confirmationImportResultats = ref(false);
const telechargementResultats = ref(false);
const messageImportResultats = ref('');
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
const appreciationResultat = (r: Pick<ResultatHistorique, 'presence' | 'note' | 'noteSource'>) => {
    if (r.presence === 'Absent' || /^ABS$/i.test(r.noteSource.trim())) return 'Absent à l’épreuve';
    if (r.note === null) return 'Note non renseignée';
    if (r.note >= 10) return 'UE validée';
    if (r.note >= 6) return 'UE capitalisable · pas à repasser';
    return 'UE non validée · à repasser';
};

const groupesResultats = computed(() => {
    const groupes = new Map<string, Map<string, ResultatHistorique[]>>();
    for (const resultat of resultats.value) {
        const ueLocale = ues.value.find((u) => u.code === resultat.codeUe);
        const codeFormation = formation(ueLocale?.formationId)?.code.toUpperCase();
        // Les résultats du classeur historique proviennent du DGC ; les UE d’un éventuel DSGC
        // sont identifiées par leur formation dans le référentiel local.
        const diplome = codeFormation?.includes('DSGC') ? 'DSGC' : 'DGC';
        const parCandidat = groupes.get(diplome) ?? new Map<string, ResultatHistorique[]>();
        const cle = resultat.etudiantId ? `id:${resultat.etudiantId}` : `nom:${resultat.nomSource.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()}`;
        const pourCandidat = parCandidat.get(cle) ?? [];
        pourCandidat.push(resultat);
        parCandidat.set(cle, pourCandidat);
        groupes.set(diplome, parCandidat);
    }

    return ['DGC', 'DSGC'].flatMap((diplome) => {
        const groupe = groupes.get(diplome);
        if (!groupe?.size) return [];
        const uesDuDiplome = ues.value.filter((u) => {
            const codeFormationUE = formation(u.formationId)?.code.toUpperCase() ?? u.formationId.toUpperCase();
            return codeFormationUE === diplome;
        });
        const codesUe = [...new Set([...uesDuDiplome.map((u) => u.code), ...[...groupe.values()].flatMap((lignes) => lignes.map((r) => r.codeUe))])];
        const colonnes = codesUe.map((code) => ({
            code,
            libelle: ues.value.find((u) => u.code === code)?.libelle ?? groupe.values().next().value?.find((r) => r.codeUe === code)?.libelleUe ?? '',
            ordre: ues.value.find((u) => u.code === code)?.ordre ?? Number.MAX_SAFE_INTEGER,
        })).sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code, 'fr', { numeric: true }));
        const candidats = [...groupe].map(([cle, lignes]) => ({
            cle,
            nom: lignes[0]?.nomSource ?? 'Candidat sans nom',
            parUe: new Map(colonnes.map((colonne) => [colonne.code, lignes.filter((r) => r.codeUe === colonne.code)])),
            ecarts: [...new Set(lignes.flatMap((r) => r.ecarts ?? []))],
        })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        return [{ diplome, colonnes, candidats }];
    });
});

const statistiquesGroupes = computed(() => groupesResultats.value.map((groupe) => {
    const compteParUe = groupe.colonnes.map((colonne) => ({
        ...colonne,
        nombre: groupe.candidats.reduce((total, candidat) => total + (candidat.parUe.get(colonne.code)?.length ?? 0), 0),
    })).filter((colonne) => colonne.nombre > 0);
    const maximumUe = Math.max(0, ...compteParUe.map((colonne) => colonne.nombre));
    const uesPlusEvaluees = compteParUe.filter((colonne) => colonne.nombre === maximumUe);
    const comptesCandidats = groupe.candidats.map((candidat) => ({
        nom: candidat.nom,
        nombre: groupe.colonnes.filter((colonne) => (candidat.parUe.get(colonne.code)?.length ?? 0) > 0).length,
    }));
    const maximumCandidat = Math.max(0, ...comptesCandidats.map((candidat) => candidat.nombre));
    return {
        diplome: groupe.diplome,
        nombreCandidats: groupe.candidats.length,
        totalResultats: compteParUe.reduce((total, colonne) => total + colonne.nombre, 0),
        uesPlusEvaluees,
        nombreMaximumUe: maximumUe,
        candidatsLesPlusEvalues: comptesCandidats.filter((candidat) => candidat.nombre === maximumCandidat && maximumCandidat > 0),
        nombreMaximumCandidat: maximumCandidat,
    };
}));

async function telechargerClasseurResultats() {
    telechargementResultats.value = true;
    erreurResultats.value = '';
    try {
        const classeur = await appeler<{ nom: string; mimeType: string; contenu: string }>('telechargerClasseurResultatsHistoriques');
        const octets = Uint8Array.from(atob(classeur.contenu), (caractere) => caractere.charCodeAt(0));
        const fichier = new Blob([octets.buffer as ArrayBuffer], { type: classeur.mimeType });
        const url = URL.createObjectURL(fichier);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = classeur.nom;
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
        erreurResultats.value = messageErreur(e);
    } finally {
        telechargementResultats.value = false;
    }
}

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

async function importerClasseurConfirme() {
    if (!apercuResultats.value || !base64Resultats.value || !fichierResultats.value) return;
    confirmationImportResultats.value = false;
    chargementResultats.value = true; erreurResultats.value = ''; messageImportResultats.value = '';
    try {
        const resultat = await appeler<{ message: string }>('importerResultatsHistoriques', { fichierBase64: base64Resultats.value, nomFichier: fichierResultats.value.name });
        messageImportResultats.value = resultat.message;
        apercuResultats.value = null;
    } catch (e) { erreurResultats.value = messageErreur(e); }
    finally { chargementResultats.value = false; }
}
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Calendrier INTEC</p>
            <h1 class="titre-page mt-1.5">Examens & convocations</h1>
            <p class="sous-titre">Calendrier officiel INTEC, candidats, convocations et retour des copies</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <label class="flex items-center gap-1 rounded-xl border border-gray-200 bg-white pl-3.5 shadow-xs transition hover:border-gray-300">
                <i class="fa-regular fa-calendar text-sm text-insec-500"></i>
                <select v-model="anneeId" class="border-0 bg-transparent py-2.5 pl-2 text-sm font-semibold text-gray-900 focus:ring-0" aria-label="Année scolaire">
                    <option v-for="a in annees" :key="a.id" :value="a.id">Année {{ a.libelle }}</option>
                </select>
            </label>
            <RouterLink to="/examens/importer-calendrier" class="bouton-secondaire"><i class="fa-solid fa-file-import text-xs"></i>Importer un calendrier INTEC</RouterLink>
        </div>
    </header>

    <div v-if="erreurCalendrier" role="status" class="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><i class="fa-solid fa-triangle-exclamation text-xs"></i></span>
        <span class="pt-1.5">Le calendrier enregistré n’a pas pu être chargé : {{ erreurCalendrier }}</span>
    </div>

    <section class="carte mb-6 overflow-hidden">
        <header class="panneau-entete">
            <div>
                <p class="surtitre text-[10.5px]">Source officielle INTEC</p>
                <h2 class="titre-section mt-1">Épreuves DGC et DSGC · {{ anneeCalendrierIntec || 'aucune année' }}</h2>
                <p v-if="calendrierOfficiel" class="mt-1 max-w-3xl text-xs leading-5 text-gray-500">{{ calendrierIntec.length }} épreuves écrites, horaires de Paris. Les dates et horaires sont ceux publiés par l’INTEC. L’INSEC peut ouvrir un suivi local pour gérer les candidats, la salle et les convocations.</p>
            </div>
            <a v-if="calendrierOfficiel" :href="calendrierOfficiel.source" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Consulter le document INTEC <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
            <a v-else href="https://intec.cnam.fr/planning-des-examens--1559071.kjsp" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Vérifier les publications INTEC <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
        </header>
        <div v-if="!calendrierOfficiel" class="px-6 py-8">
            <p class="font-semibold text-gray-900">Aucun calendrier {{ anneeCalendrierIntec }} n’est intégré dans l’application.</p>
            <p class="mt-1 text-sm text-gray-500">Consultez la page officielle de l’INTEC pour vérifier si les dates de cette année ont été publiées.</p>
        </div>
        <div v-else>
            <div class="overflow-x-auto">
                <table class="tableau">
                    <thead><tr><th>Date et heure</th><th>Diplôme / UE INTEC</th><th>UE locale</th><th class="text-right">Suivi INSEC</th></tr></thead>
                    <tbody>
                        <tr v-for="e in calendrierIntec" :key="e.codeUE">
                            <td>
                                <div class="flex items-center gap-3">
                                    <span class="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl bg-white text-center ring-1 ring-gray-200">
                                        <span class="w-full bg-insec-900 py-0.5 text-[9.5px] font-semibold tracking-wider text-white uppercase">{{ e.dateFr.split(' ')[1]?.slice(0, 4) }}</span>
                                        <span class="py-0.5 font-titre text-base leading-6 font-bold text-gray-900">{{ e.dateFr.split(' ')[0] }}</span>
                                    </span>
                                    <span>
                                        <strong class="block whitespace-nowrap font-semibold text-gray-900">{{ e.dateFr }}</strong>
                                        <span class="mt-1 flex flex-wrap gap-1.5">
                                            <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><i class="fa-regular fa-clock text-[10px]"></i>{{ e.heure }} (Paris)</span>
                                            <span class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><i class="fa-regular fa-clock text-[10px]"></i>{{ heureNouakchottDepuisParis(e.date, e.heure) }} (Nouakchott)</span>
                                        </span>
                                    </span>
                                </div>
                            </td>
                            <td><span class="font-semibold text-gray-900">{{ e.diplôme }} · {{ e.codeUE }}</span><span class="block text-xs text-gray-500">{{ e.intitule }}</span></td>
                            <td>
                                <span v-if="e.ue" class="font-medium text-gray-800">{{ e.ue.code }} · {{ e.ue.libelle }}</span>
                                <span v-else class="pastille bg-amber-50 text-amber-800 ring-amber-600/20"><span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>UE non trouvée dans le référentiel local</span>
                            </td>
                            <td class="text-right">
                                <RouterLink
                                    v-if="e.ue && anneeCalendrierIntec"
                                    :to="{ path: '/examens/nouveau', query: { source: 'intec', ue: e.codeUE, annee: anneeCalendrierIntec, dateHeure: e.dateHeure, session: 'Normale' } }"
                                    class="bouton-secondaire"
                                >Suivre l’épreuve</RouterLink>
                                <span v-else class="text-sm text-gray-400">Indisponible</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="flex items-start gap-3 border-t border-gray-100 bg-amber-50/50 px-5 py-3.5 text-sm text-amber-950 sm:px-6">
                <i class="fa-solid fa-circle-info mt-0.5 text-amber-500"></i>
                <span>Les dates individuelles des soutenances sont communiquées séparément par l’INTEC. Les informations du calendrier restent sous la responsabilité de l’INTEC ; le suivi local ne permet pas de modifier leur date ou leur horaire.</span>
            </div>
        </div>
    </section>

    <section class="mb-6">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
                <h2 class="titre-section">Suivis locaux des épreuves</h2>
                <p class="mt-0.5 text-xs text-gray-500">Candidats, salle, convocations et retour des copies à l’INTEC</p>
            </div>
        </div>
        <Chargement :chargement="chargement" :erreur="erreur">
            <div class="carte overflow-x-auto">
                <table class="tableau">
                    <thead><tr><th>Date et heure</th><th>Diplôme / UE</th><th>Session</th><th>Salle</th><th>Convoqués</th><th>Statut</th></tr></thead>
                    <tbody>
                        <tr v-for="e in affiches" :key="e.id" class="cursor-pointer" @click="router.push(`/examens/${e.id}`)">
                            <td class="font-medium whitespace-nowrap text-gray-800">{{ horaireExamen(e.dateExamen) }}</td>
                            <td><strong class="font-semibold text-gray-900">{{ formation(e.formationId)?.code }} · {{ ue(e.ueId)?.code }}</strong><span class="block text-xs text-gray-500">{{ ue(e.ueId)?.libelle }}</span></td>
                            <td>{{ e.session }}<span class="block text-xs text-gray-500">{{ annee(e.anneeId)?.libelle }}</span></td>
                            <td>{{ e.salle || '—' }}</td>
                            <td class="tabular-nums">{{ e.nbConvoques }}</td>
                            <td>
                                <span :class="['pastille', e.statut === 'Planifié' ? 'bg-insec-50 text-insec-700 ring-insec-600/15' : 'bg-gray-50 text-gray-600 ring-gray-500/15']">
                                    <span :class="['h-1.5 w-1.5 rounded-full', e.statut === 'Planifié' ? 'bg-insec-500' : 'bg-gray-400']"></span>
                                    {{ e.statut === 'Planifié' ? 'À venir · calendrier INTEC' : e.statut }}
                                </span>
                            </td>
                        </tr>
                        <tr v-if="!examens.length" class="hover:bg-transparent">
                            <td colspan="6" class="p-0">
                                <div class="flex flex-col items-center px-6 py-12 text-center">
                                    <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i></span>
                                    <h2 class="mt-3 font-semibold text-gray-900">{{ anneeId ? 'Aucun examen pour cette année scolaire' : 'Aucun suivi local n’est encore ouvert' }}</h2>
                                    <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
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
    </section>

    <section class="carte overflow-hidden" aria-labelledby="resultats-historiques">
        <header class="panneau-entete">
            <div>
                <p class="surtitre text-[10.5px]">Résultats · {{ annee(anneeId)?.libelle ?? anneeId }}</p>
                <h2 id="resultats-historiques" class="titre-section mt-1">Notes par étudiant et par UE</h2>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ resultats.length }} résultat(s) historique(s)</span>
                <button v-if="anneeId === '2024-2025'" class="bouton-secondaire" :disabled="telechargementResultats" @click="telechargerClasseurResultats">
                    <i class="fa-solid fa-file-excel text-xs text-emerald-600"></i>{{ telechargementResultats ? 'Préparation du fichier…' : 'Télécharger le classeur Excel' }}
                </button>
            </div>
        </header>
        <div class="p-5 sm:p-6">
            <div v-if="statistiquesGroupes.length" class="space-y-4">
                <section v-for="stat in statistiquesGroupes" :key="stat.diplome" class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                    <h3 class="mb-3 text-sm font-semibold text-gray-900">{{ stat.diplome }} · récapitulatif des résultats</h3>
                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <article class="carte p-4"><p class="text-xs font-medium text-gray-500">Candidats avec résultats</p><p class="mt-1.5 font-titre text-2xl font-bold text-gray-900 tabular-nums">{{ stat.nombreCandidats }}</p></article>
                        <article class="carte p-4"><p class="text-xs font-medium text-gray-500">Résultats enregistrés</p><p class="mt-1.5 font-titre text-2xl font-bold text-gray-900 tabular-nums">{{ stat.totalResultats }}</p></article>
                        <article class="carte p-4"><p class="text-xs font-medium text-gray-500">UE la plus évaluée</p><p class="mt-1.5 font-semibold text-gray-900">{{ stat.uesPlusEvaluees.map((ue) => ue.code).join(', ') || '—' }}</p><p v-if="stat.nombreMaximumUe" class="mt-0.5 text-xs text-gray-500">Maximum : {{ stat.nombreMaximumUe }} résultat(s) par UE</p></article>
                        <article class="carte p-4">
                            <p class="text-xs font-medium text-gray-500">Candidats avec le plus d’UE notées</p>
                            <p class="mt-1.5 font-titre text-2xl font-bold text-gray-900 tabular-nums">{{ stat.candidatsLesPlusEvalues.length }}</p>
                            <p v-if="stat.nombreMaximumCandidat" class="mt-0.5 text-xs text-gray-500">{{ stat.nombreMaximumCandidat }} UE notée(s) chacun</p>
                            <details v-if="stat.candidatsLesPlusEvalues.length" class="group mt-2">
                                <summary class="flex items-center gap-1.5 text-xs font-semibold text-insec-600 hover:text-insec-800">Voir les noms <i class="fa-solid fa-chevron-down text-[9px] transition group-open:rotate-180"></i></summary>
                                <p class="mt-1.5 text-xs leading-5 text-gray-600">{{ stat.candidatsLesPlusEvalues.map((candidat) => candidat.nom).join(', ') }}</p>
                            </details>
                        </article>
                    </div>
                </section>
            </div>

            <div v-if="anneeId === '2024-2025'" class="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label class="etiquette">Classeur Excel de référence
                    <input type="file" accept=".xlsx" class="champ mt-1.5 py-2" @change="lireFichierResultats" />
                </label>
                <button class="bouton-secondaire" :disabled="!base64Resultats || chargementResultats" @click="analyserClasseur">{{ chargementResultats ? 'Analyse…' : 'Analyser le classeur' }}</button>
                <button class="bouton-action" :disabled="!apercuResultats || chargementResultats" @click="confirmationImportResultats = true">Importer les résultats</button>
            </div>
            <div v-if="anneeId === '2024-2025' && confirmationImportResultats" role="alertdialog" aria-labelledby="confirmation-import-resultats" class="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><i class="fa-solid fa-triangle-exclamation text-xs"></i></span>
                <div class="min-w-0 flex-1">
                    <p id="confirmation-import-resultats" class="font-semibold text-amber-950">Confirmer l’import de {{ apercuResultats?.total }} résultats historiques ?</p>
                    <p class="mt-1 text-sm text-amber-900">{{ apercuResultats?.ecarts }} écart(s) seront conservés comme alertes. Aucune inscription ne sera créée ; les lignes historiques correspondantes seront remplacées.</p>
                    <div class="mt-3 flex flex-wrap justify-end gap-2">
                        <button class="bouton-secondaire" :disabled="chargementResultats" @click="confirmationImportResultats = false">Annuler</button>
                        <button class="bouton-action" :disabled="chargementResultats" @click="importerClasseurConfirme">{{ chargementResultats ? 'Importation…' : 'Confirmer l’importation' }}</button>
                    </div>
                </div>
            </div>
            <p v-if="anneeId === '2024-2025' && messageImportResultats" role="status" class="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
                <i class="fa-solid fa-circle-check mt-0.5 text-emerald-500"></i><span>{{ messageImportResultats }}</span>
            </p>
            <p v-if="anneeId === '2024-2025' && erreurResultats" role="alert" class="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800">
                <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i><span>{{ erreurResultats }}</span>
            </p>
            <div v-if="anneeId === '2024-2025' && apercuResultats" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <p class="font-semibold text-amber-950">Aperçu : {{ apercuResultats.total }} résultat(s), {{ apercuResultats.ecarts }} écart(s) à vérifier.</p>
                <p class="mt-1 text-sm text-amber-900">Les lignes sont copiées du classeur. L’importation ne crée aucune inscription.</p>
                <div class="carte mt-3 max-h-80 overflow-auto">
                    <table class="tableau">
                        <thead><tr><th>Candidat Excel</th><th>UE</th><th>Note source</th><th>Appréciation</th><th>Écart</th></tr></thead>
                        <tbody><tr v-for="(r, index) in apercuResultats.lignes" :key="`${r.nomSource}-${r.codeUe}-${index}`">
                            <td class="font-medium text-gray-900">{{ r.nomSource }}</td><td>{{ r.codeUe }} · {{ r.libelleUe }}</td><td class="font-semibold tabular-nums">{{ r.noteSource }}</td><td>{{ appreciationResultat(r) }}</td>
                            <td><ul v-if="r.ecarts.length" class="list-disc pl-4 text-sm text-amber-900"><li v-for="e in r.ecarts" :key="e">{{ e }}</li></ul><span v-else class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Concordant</span></td>
                        </tr></tbody>
                    </table>
                </div>
            </div>

            <div v-if="groupesResultats.length" class="mt-5 space-y-5">
                <section v-for="groupe in groupesResultats" :key="groupe.diplome" class="overflow-hidden rounded-2xl border border-gray-200">
                    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                        <h3 class="text-sm font-semibold text-gray-900">{{ groupe.diplome }} · résultats par UE</h3>
                        <span class="text-xs text-gray-500">{{ groupe.candidats.length }} candidat(s) · {{ groupe.colonnes.length }} UE</span>
                    </header>
                    <p class="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500"><i class="fa-solid fa-arrows-left-right text-[10px]"></i>Faites défiler horizontalement pour consulter toutes les unités d’enseignement.</p>
                    <div class="overflow-x-auto">
                        <table class="tableau min-w-max">
                            <thead><tr><th class="sticky top-0 left-0 z-20 min-w-52 bg-gray-50">Étudiant</th><th v-for="colonne in groupe.colonnes" :key="colonne.code" class="min-w-44"><span class="block">{{ colonne.code }}</span><span class="text-[11px] font-normal tracking-normal text-gray-400 normal-case">{{ colonne.libelle }}</span></th><th class="min-w-56">Écarts à vérifier</th></tr></thead>
                            <tbody>
                                <tr v-for="candidat in groupe.candidats" :key="candidat.cle" :class="candidat.ecarts.length ? 'bg-amber-50/60' : ''">
                                    <th scope="row" :class="['sticky left-0 z-10 min-w-52 px-4 text-left font-medium text-gray-900', candidat.ecarts.length ? 'bg-amber-50' : 'bg-white']">{{ candidat.nom }}</th>
                                    <td v-for="colonne in groupe.colonnes" :key="colonne.code" class="align-top">
                                        <template v-if="candidat.parUe.get(colonne.code)?.length">
                                            <div v-for="(r, index) in candidat.parUe.get(colonne.code)" :key="r.id" :class="index ? 'mt-2 border-t border-gray-200 pt-2' : ''">
                                                <strong class="font-semibold text-gray-900 tabular-nums">{{ r.noteSource }}</strong>
                                                <span class="mt-0.5 block text-xs text-gray-500">{{ appreciationResultat(r) }}</span>
                                            </div>
                                        </template>
                                        <span v-else class="text-gray-300" title="Aucun résultat renseigné">—</span>
                                    </td>
                                    <td>
                                        <span v-if="!candidat.ecarts.length" class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Aucun écart signalé</span>
                                        <ul v-else class="list-disc pl-4 text-sm text-amber-900"><li v-for="ecart in candidat.ecarts" :key="ecart">{{ ecart }}</li></ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
            <p v-else-if="anneeId === '2024-2025'" class="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
                <i class="fa-solid fa-circle-info mt-0.5 text-amber-500"></i><span>Aucun résultat n’est encore chargé pour cette année. Sélectionnez le classeur Excel de référence ci-dessus pour afficher les notes par étudiant.</span>
            </p>
            <p v-else class="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 text-sm text-gray-600" :class="statistiquesGroupes.length ? 'mt-5' : ''">
                <i class="fa-solid fa-circle-info mt-0.5 text-gray-400"></i><span>Aucun résultat historique n’est enregistré pour {{ annee(anneeId)?.libelle ?? anneeId }}. Les résultats du classeur concernent uniquement 2024–2025.</span>
            </p>
        </div>
    </section>
</template>
