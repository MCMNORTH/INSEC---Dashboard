<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { CALENDRIERS_INTEC, CALENDRIER_INTEC_2026_2027 } from '../../calendrierIntec';
import { appeler, messageErreur } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { heureNouakchott, heureNouakchottDepuisParis, montant } from '../../format';
import { session } from '../../session';

interface TacheAFaire {
    cle: string;
    niveau: 'danger' | 'warning' | 'info';
    titre: string;
    detail: string;
    lien: string | RouteLocationRaw;
}

interface Tableau {
    aFaire: TacheAFaire[];
    annees: { id: string; libelle: string }[];
    anneeId: string | null;
    montantEnRetard: number;
    resteARecouvrer: number;
    impayes: { inscriptionId: string; etudiantId: string; etudiant: string; formation: string; solde: number; retard: number }[];
    examensProchains: { id: string; ue: string; dateExamen: string; salle: string | null }[];
    totalEtudiants: number;
    etudiantsInscrits: number;
    etudiantsSansInscription: number;
    etudiantsAvecDossierAnnee: number;
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

const anneeSelectionnee = computed(() => tableau.value ? libelleAnnee(tableau.value) : '');
const calendrierIntec = computed(() =>
    CALENDRIERS_INTEC[anneeSelectionnee.value as keyof typeof CALENDRIERS_INTEC] ?? null,
);
const prochainesEpreuvesOfficielles = computed(() => {
    const calendrier = calendrierIntec.value;
    if (!calendrier) return [];
    const pieces = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const dateParis = Object.fromEntries(pieces.map((p) => [p.type, p.value]));
    const aujourdHui = `${dateParis.year}-${dateParis.month}-${dateParis.day}`;
    return calendrier.examens.filter((e) => e.date >= aujourdHui).slice(0, 4);
});

function lienSuiviIntec(e: (typeof CALENDRIER_INTEC_2026_2027)[number]) {
    return {
        path: '/examens/nouveau',
        query: { source: 'intec', ue: e.codeUE, annee: anneeSelectionnee.value, dateHeure: `${e.date}T${e.heure}`, session: 'Normale' },
    };
}

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

/** Tâches du serveur + épreuves INTEC à J-15 pour lesquelles aucun suivi local n'est encore ouvert. */
const tachesAFaire = computed<TacheAFaire[]>(() => {
    const t = tableau.value;
    if (!t) return [];
    const calendrier = calendrierIntec.value;
    const dansQuinzeJours = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const sansSuivi: TacheAFaire[] = (calendrier ? prochainesEpreuvesOfficielles.value : [])
        .filter((e) => e.date <= dansQuinzeJours && !t.examensProchains.some((x) => x.ue === `TEC${e.codeUE}`))
        .map((e) => ({
            cle: `suivi-${e.diplôme}-${e.codeUE}`,
            niveau: 'warning',
            titre: `${e.diplôme} · UE ${e.codeUE} : ouvrir le suivi de l’épreuve`,
            detail: `Épreuve INTEC le ${e.dateFr} à ${e.heure} (Paris) · ${heureNouakchottDepuisParis(e.date, e.heure)} (Nouakchott).`,
            lien: lienSuiviIntec(e),
        }));
    const ordre = { danger: 0, warning: 1, info: 2 };
    return [...t.aFaire, ...sansSuivi].sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
});
const STYLE_TACHE = {
    danger: { pastille: 'bg-red-50 text-red-600 ring-red-100', icone: 'fa-circle-exclamation', barre: 'bg-red-500' },
    warning: { pastille: 'bg-amber-50 text-amber-600 ring-amber-100', icone: 'fa-triangle-exclamation', barre: 'bg-amber-400' },
    info: { pastille: 'bg-insec-50 text-insec-600 ring-insec-100', icone: 'fa-circle-info', barre: 'bg-insec-400' },
} as const;

// Salutation et date à l'heure de Nouakchott (UTC+0 toute l'année).
const heureLocale = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Nouakchott' }).format(new Date()));
const salutation = heureLocale >= 18 || heureLocale < 4 ? 'Bonsoir' : 'Bonjour';
const prenom = computed(() => session.nom.split(' ')[0] ?? '');
const aujourdHui = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nouakchott' }).format(new Date());
const initialesNom = (nom: string) => nom.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const cartes = (t: Tableau) => [
    {
        libelle: 'Inscrits à l’INSEC',
        valeur: String(t.etudiantsInscrits),
        unite: '',
        detail: 'Inscription active · ' + libelleAnnee(t),
        icone: 'fa-id-card',
        teinte: 'from-insec-500 to-insec-700',
        lien: { path: '/etudiants', query: { anneeId: t.anneeId ?? undefined, inscription: 'inscrits' } },
    },
    {
        libelle: 'Inscriptions non actives',
        valeur: String(t.etudiantsSansInscription),
        unite: '',
        detail: 'Suspendues, annulées ou terminées',
        icone: 'fa-user-minus',
        teinte: 'from-slate-400 to-slate-600',
        lien: { path: '/etudiants', query: { anneeId: t.anneeId ?? undefined, inscription: 'non-actifs' } },
    },
    {
        libelle: 'Suivis cette année',
        valeur: String(t.etudiantsAvecDossierAnnee),
        unite: '',
        detail: 'Avec un dossier ' + libelleAnnee(t),
        icone: 'fa-users',
        teinte: 'from-sky-400 to-sky-600',
        lien: { path: '/etudiants', query: { anneeId: t.anneeId ?? undefined, inscription: 'dossiers-annee' } },
    },
    {
        libelle: 'Prochaines épreuves',
        valeur: String(t.examensProchains.length),
        unite: '',
        detail: 'Dans les 30 prochains jours',
        icone: 'fa-calendar-days',
        teinte: 'from-amber-400 to-orange-500',
        lien: { path: '/examens' },
    },
    {
        libelle: 'Reste à recouvrer',
        valeur: montant(t.resteARecouvrer),
        unite: 'MRU',
        detail: 'Sur l’année scolaire choisie',
        icone: 'fa-wallet',
        teinte: 'from-emerald-400 to-emerald-600',
        lien: { path: '/finances', query: { annee: t.anneeId ?? undefined } },
    },
] as const;
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre first-letter:uppercase">{{ aujourdHui }}</p>
            <h1 class="titre-page mt-1.5">{{ salutation }}{{ prenom ? `, ${prenom}` : '' }}</h1>
            <p class="sous-titre">Voici où en est l’année scolaire : actions à mener, inscriptions, examens et paiements.</p>
        </div>
        <label class="flex items-center gap-1 rounded-xl border border-gray-200 bg-surface pl-3.5 shadow-xs transition hover:border-gray-300">
            <i class="fa-regular fa-calendar text-sm text-insec-500"></i>
            <span class="sr-only">Année scolaire</span>
            <select v-model="anneeId" class="border-0 bg-transparent py-2.5 pl-2 text-sm font-semibold text-gray-900 focus:ring-0">
                <option v-for="a in tableau?.annees ?? []" :key="a.id" :value="a.id">Année {{ a.libelle }}</option>
            </select>
        </label>
    </header>

    <Chargement :chargement="chargement && !tableau" :erreur="erreur">
        <template v-if="tableau">
            <section class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]" :class="{ 'opacity-60 transition': chargement }" aria-label="Chiffres clés">
                <RouterLink
                    v-for="carte in cartes(tableau)"
                    :key="carte.libelle"
                    :to="carte.lien"
                    class="carte group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-flottant"
                >
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">{{ carte.libelle }}</p>
                        <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm', carte.teinte]">
                            <i :class="['fa-solid text-[13px]', carte.icone]"></i>
                        </span>
                    </div>
                    <p class="mt-3 font-titre text-[1.75rem] leading-none font-bold tracking-tight text-gray-900 tabular-nums">
                        {{ carte.valeur }}<span v-if="carte.unite" class="ml-1 text-sm font-semibold text-gray-400">{{ carte.unite }}</span>
                    </p>
                    <p class="mt-2.5 flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span>{{ carte.detail }}</span>
                        <i class="fa-solid fa-arrow-right -translate-x-1 text-[10px] text-insec-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"></i>
                    </p>
                </RouterLink>
            </section>

            <div v-if="tableau.montantEnRetard > 0" class="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-red-200/80 bg-linear-to-r from-red-50 to-surface p-4 sm:px-5">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><i class="fa-solid fa-triangle-exclamation"></i></span>
                <p class="min-w-0 flex-1 text-sm text-red-900"><strong class="font-semibold">{{ montant(tableau.montantEnRetard) }} MRU</strong> de paiements sont en retard.</p>
                <RouterLink to="/finances" class="bouton-secondaire">Consulter les finances <i class="fa-solid fa-arrow-right text-xs"></i></RouterLink>
            </div>

            <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <section class="carte overflow-hidden xl:col-span-2" aria-labelledby="a-faire" :class="{ 'opacity-60': chargement }">
                    <header class="panneau-entete">
                        <div>
                            <h2 id="a-faire" class="titre-section">À faire aujourd’hui</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Les actions qui demandent votre attention · {{ anneeSelectionnee }}</p>
                        </div>
                        <span :class="['pastille', tachesAFaire.length ? 'bg-amber-50 text-amber-800 ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/15']">
                            <span :class="['h-1.5 w-1.5 rounded-full', tachesAFaire.length ? 'bg-amber-500' : 'bg-emerald-500']"></span>
                            {{ tachesAFaire.length ? `${tachesAFaire.length} action${tachesAFaire.length > 1 ? 's' : ''}` : 'Tout est à jour' }}
                        </span>
                    </header>
                    <ul v-if="tachesAFaire.length" class="divide-y divide-gray-100">
                        <li v-for="t in tachesAFaire" :key="t.cle">
                            <RouterLink :to="t.lien" class="group relative flex items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50/80 sm:px-6">
                                <span :class="['absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full opacity-0 transition group-hover:opacity-100', STYLE_TACHE[t.niveau].barre]"></span>
                                <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1', STYLE_TACHE[t.niveau].pastille]">
                                    <i :class="['fa-solid text-sm', STYLE_TACHE[t.niveau].icone]"></i>
                                </span>
                                <span class="min-w-0 flex-1">
                                    <strong class="block text-sm font-semibold text-gray-900">{{ t.titre }}</strong>
                                    <span class="mt-0.5 block text-xs text-gray-500">{{ t.detail }}</span>
                                </span>
                                <span class="hidden items-center gap-1.5 text-xs font-semibold text-insec-600 sm:flex">
                                    Ouvrir <i class="fa-solid fa-arrow-right text-[10px] transition group-hover:translate-x-0.5"></i>
                                </span>
                            </RouterLink>
                        </li>
                    </ul>
                    <div v-else class="flex flex-col items-center px-6 py-12 text-center">
                        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><i class="fa-solid fa-check"></i></span>
                        <p class="mt-3 font-semibold text-gray-900">Rien d’urgent</p>
                        <p class="mt-1 max-w-sm text-sm text-gray-500">Aucun retard de paiement, aucune convocation ni aucun envoi de copies en attente.</p>
                    </div>
                </section>

                <section class="carte overflow-hidden" aria-labelledby="paiements">
                    <header class="panneau-entete">
                        <div>
                            <h2 id="paiements" class="titre-section">Suivi des paiements</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Soldes à traiter pour l’année choisie</p>
                        </div>
                        <RouterLink to="/finances" aria-label="Ouvrir les finances" class="bouton-icone"><i class="fa-solid fa-arrow-up-right-from-square text-sm"></i></RouterLink>
                    </header>
                    <div v-if="tableau.impayes.length" class="divide-y divide-gray-100">
                        <RouterLink v-for="i in tableau.impayes" :key="i.inscriptionId" :to="{ path: '/finances', query: { etudiant: i.etudiantId, inscription: i.inscriptionId } }" class="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50/80 sm:px-6">
                            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec-50 text-[11px] font-bold text-insec-700 ring-1 ring-insec-100">{{ initialesNom(i.etudiant) }}</span>
                            <span class="min-w-0 flex-1">
                                <strong class="block truncate text-sm font-semibold text-gray-900">{{ i.etudiant }}</strong>
                                <span :class="['block truncate text-xs', i.retard > 0 ? 'text-red-600' : 'text-gray-500']">
                                    {{ i.retard > 0 ? 'Retard : ' + montant(i.retard) + ' MRU' : i.formation }}
                                </span>
                            </span>
                            <strong class="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{{ montant(i.solde) }} <span class="text-[11px] font-medium text-gray-400">MRU</span></strong>
                        </RouterLink>
                    </div>
                    <div v-else class="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><i class="fa-solid fa-circle-check"></i></span>
                        <p class="mt-3 font-semibold text-gray-900">Aucun solde à suivre</p>
                        <p class="mt-1 text-sm text-gray-500">Les paiements en attente apparaîtront ici.</p>
                    </div>
                </section>

                <section class="carte overflow-hidden xl:col-span-2" aria-labelledby="calendrier-intec">
                    <header class="panneau-entete">
                        <div>
                            <p class="surtitre text-[10.5px]">Calendrier officiel INTEC · {{ anneeSelectionnee }}</p>
                            <h2 id="calendrier-intec" class="titre-section mt-1">Prochaines épreuves écrites</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Heures de Paris et de Nouakchott · distinctes des sessions planifiées localement</p>
                        </div>
                        <a v-if="calendrierIntec" :href="calendrierIntec.source" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Document officiel <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
                        <a v-else href="https://intec.cnam.fr/planning-des-examens--1559071.kjsp" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Publications INTEC <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
                    </header>
                    <div v-if="!calendrierIntec" class="px-6 py-8">
                        <p class="font-semibold text-gray-900">Aucun calendrier {{ anneeSelectionnee }} n’est intégré dans le tableau de bord.</p>
                        <p class="mt-1 text-sm text-gray-500">Consultez la page officielle de l’INTEC pour vérifier si les dates de cette année ont été publiées.</p>
                    </div>
                    <ul v-else-if="prochainesEpreuvesOfficielles.length" class="divide-y divide-gray-100">
                        <li v-for="e in prochainesEpreuvesOfficielles" :key="e.codeUE" class="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                            <span class="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl bg-surface text-center ring-1 ring-gray-200">
                                <span class="w-full bg-insec-600 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">{{ e.dateFr.split(' ')[1]?.slice(0, 4) }}</span>
                                <span class="py-1 font-titre text-lg leading-6 font-bold text-gray-900">{{ e.dateFr.split(' ')[0] }}</span>
                            </span>
                            <span class="min-w-0 flex-1">
                                <strong class="block text-sm font-semibold text-gray-900">{{ e.diplôme }} · UE {{ e.codeUE }}</strong>
                                <span class="block truncate text-xs text-gray-500">{{ e.intitule }}</span>
                                <span class="mt-1.5 flex flex-wrap gap-1.5">
                                    <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><i class="fa-regular fa-clock text-[10px]"></i>{{ e.heure }} Paris</span>
                                    <span class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><i class="fa-regular fa-clock text-[10px]"></i>{{ heureNouakchottDepuisParis(e.date, e.heure) }} Nouakchott</span>
                                </span>
                            </span>
                            <RouterLink :to="lienSuiviIntec(e)" class="bouton-secondaire">Ouvrir le suivi</RouterLink>
                        </li>
                    </ul>
                    <p v-else class="px-6 py-8 text-sm text-gray-500">Les épreuves de ce calendrier sont passées. Consultez le document INTEC pour les prochaines dates publiées.</p>
                </section>

                <section class="carte overflow-hidden" aria-labelledby="prochains-examens">
                    <header class="panneau-entete">
                        <div>
                            <h2 id="prochains-examens" class="titre-section">Examens planifiés</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Sessions suivies dans les 30 prochains jours</p>
                        </div>
                        <RouterLink to="/examens" aria-label="Voir les examens" class="bouton-icone"><i class="fa-solid fa-arrow-up-right-from-square text-sm"></i></RouterLink>
                    </header>
                    <div v-if="tableau.examensProchains.length" class="divide-y divide-gray-100">
                        <RouterLink v-for="e in tableau.examensProchains" :key="e.id" :to="`/examens/${e.id}`" class="flex items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50/80 sm:px-6">
                            <span class="flex w-12 shrink-0 flex-col items-center rounded-xl bg-amber-50 py-1.5 text-center text-amber-800 ring-1 ring-amber-100">
                                <span class="text-[10px] font-semibold uppercase">{{ dateParis(e.dateExamen).split(' ')[1] }}</span>
                                <span class="font-titre text-base leading-5 font-bold">{{ dateParis(e.dateExamen).split(' ')[0] }}</span>
                            </span>
                            <span class="min-w-0 flex-1">
                                <strong class="block truncate text-sm font-semibold text-gray-900">{{ e.ue }}</strong>
                                <span class="mt-0.5 block text-xs text-gray-500">{{ heureParis(e.dateExamen) }} Paris · {{ heureNouakchott(e.dateExamen) }} Nouakchott</span>
                                <span class="block text-xs text-gray-400">{{ e.salle || 'Salle à définir' }}</span>
                            </span>
                            <i class="fa-solid fa-chevron-right text-[10px] text-gray-300"></i>
                        </RouterLink>
                    </div>
                    <div v-else class="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><i class="fa-regular fa-calendar"></i></span>
                        <p class="mt-3 font-semibold text-gray-900">Aucun examen proche</p>
                        <p class="mt-1 max-w-xs text-sm text-gray-500">Les examens prévus dans les 30 prochains jours apparaîtront ici.</p>
                    </div>
                </section>
            </div>
        </template>
    </Chargement>
</template>
