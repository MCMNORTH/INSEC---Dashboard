<script setup lang="ts">
import { collection, orderBy, query } from 'firebase/firestore';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../../api';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import ModaleConfirmation from '../../composants/ModaleConfirmation.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Etudiant, Inscription } from '../../types';

const router = useRouter();
const route = useRoute();
const { formationsActives, annees, anneeCourante, formation } = useReferentiel();
const { donnees: etudiants, chargement, erreur } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const {
    donnees: inscriptions,
    chargement: chargementInscriptions,
    erreur: erreurInscriptions,
} = useRequete<Inscription>(() => query(collection(db, 'inscriptions')));
const recherche = ref('');
const formationId = ref('');
const anneeId = ref(typeof route.query.anneeId === 'string' ? route.query.anneeId : '');
type FiltreInscription = 'dossiers-annee' | 'inscrits' | 'non-actifs' | 'annuaire';
const lireFiltreInscription = (valeur: unknown): FiltreInscription => {
    if (valeur === 'inscrits') return 'inscrits';
    if (valeur === 'non-actifs' || valeur === 'non-inscrits') return 'non-actifs';
    if (valeur === 'annuaire' || valeur === 'tous') return 'annuaire';
    if (valeur === 'dossiers-annee') return 'dossiers-annee';
    return 'dossiers-annee';
};
const filtreInscription = ref<FiltreInscription>(lireFiltreInscription(route.query.inscription));
const page = ref(1);
const PAR_PAGE = 10;

watch(annees, (liste) => {
    const anneeDemandee = route.query.anneeId;
    if (typeof anneeDemandee === 'string' && liste.some((a) => a.id === anneeDemandee)) {
        anneeId.value = anneeDemandee;
    } else if (!anneeId.value || !liste.some((a) => a.id === anneeId.value)) {
        anneeId.value = anneeCourante.value?.id ?? '';
    }
}, { immediate: true });

watch(() => [route.query.anneeId, route.query.inscription] as const, ([annee, inscription]) => {
    if (typeof annee === 'string') anneeId.value = annee;
    if (inscription !== undefined) filtreInscription.value = lireFiltreInscription(inscription);
});

const normaliser = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const inscriptionsPour = (etudiantId: string) =>
    inscriptions.value.filter((i) => i.etudiantId === etudiantId && i.anneeId === anneeId.value);
const etudiantsAvecDossierAnnee = computed(() => new Set(
    inscriptions.value.filter((i) => i.anneeId === anneeId.value).map((i) => i.etudiantId),
).size);
const etudiantsInscritsAnnee = computed(() => new Set(
    inscriptions.value.filter((i) => i.anneeId === anneeId.value && i.statut === 'active').map((i) => i.etudiantId),
).size);
const situationInscription = (etudiantId: string) => {
    const inscriptionsAnnee = inscriptionsPour(etudiantId);
    const inscrit = inscriptionsAnnee.some((i) => i.statut === 'active');
    const libelles: Record<string, string> = {
        suspendue: 'Inscription suspendue',
        annulée: 'Inscription annulée',
        terminée: 'Inscription terminée',
    };
    const detail = !inscriptionsAnnee.length
        ? `Aucune inscription enregistrée pour ${libelleAnnee.value}.`
        : inscrit
            ? null
            : [...new Set(inscriptionsAnnee.map((i) => libelles[i.statut] ?? 'Inscription non active'))].join(' · ');
    return { inscrit, aDossier: inscriptionsAnnee.length > 0, detail };
};

const filtres = computed(() => {
    const terme = normaliser(recherche.value.trim());
    return etudiants.value.filter((e) => {
        const inscriptionsAnnee = inscriptionsPour(e.id);
        const inscrit = inscriptionsAnnee.some((i) => i.statut === 'active');
        return (!terme || [e.nom, e.prenom, e.email].some((v) => normaliser(v ?? '').includes(terme)))
            && (!formationId.value || inscriptionsAnnee.some((i) => i.formationId === formationId.value))
            && (filtreInscription.value === 'annuaire'
                || (filtreInscription.value === 'dossiers-annee' && inscriptionsAnnee.length > 0)
                || (filtreInscription.value === 'inscrits' && inscrit)
                || (filtreInscription.value === 'non-actifs' && inscriptionsAnnee.length > 0 && !inscrit));
    });
});
const affiches = computed(() => filtres.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE));
const inscritsAnnee = etudiantsInscritsAnnee;
const dossiersAverifierAnnee = computed(() => Math.max(0, etudiantsAvecDossierAnnee.value - inscritsAnnee.value));
const libelleAnnee = computed(() => annees.value.find((a) => a.id === anneeId.value)?.libelle ?? 'année sélectionnée');
watch([recherche, formationId, filtreInscription, anneeId], () => (page.value = 1));

function effacerFiltres() {
    recherche.value = '';
    formationId.value = '';
    filtreInscription.value = 'dossiers-annee';
}

const aSupprimer = ref<Etudiant | null>(null);
const { envoi, soumettre } = useFormulaire();
async function supprimer() {
    const cible = aSupprimer.value;
    if (!cible) return;
    const resultat = await soumettre(() => appeler('supprimerEtudiant', { id: cible.id }));
    aSupprimer.value = null;
    if (resultat) notifier(resultat.message ?? 'Étudiant supprimé.');
}
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Registre INSEC</p>
            <h1 class="titre-page mt-1.5">Étudiants</h1>
            <p class="sous-titre">Vérifiez l’inscription à l’INSEC pour chaque année scolaire. L’historique reste sur la fiche de l’étudiant.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <label class="flex items-center gap-1 rounded-xl border border-gray-200 bg-surface pl-3.5 shadow-xs transition hover:border-gray-300">
                <i class="fa-regular fa-calendar text-sm text-insec-500"></i>
                <span class="sr-only">Année scolaire</span>
                <select v-model="anneeId" class="border-0 bg-transparent py-2.5 pl-2 text-sm font-semibold text-gray-900 focus:ring-0" aria-label="Année scolaire">
                    <option v-for="a in annees" :key="a.id" :value="a.id">Année {{ a.libelle }}</option>
                </select>
            </label>
            <RouterLink to="/etudiants/nouveau" class="bouton-action"><i class="fa-solid fa-plus text-xs"></i> Nouvel étudiant</RouterLink>
        </div>
    </header>

    <section class="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Résumé des inscriptions pour l’année sélectionnée">
        <button type="button" :class="['carte group flex cursor-pointer items-center justify-between p-5 text-left transition hover:-translate-y-0.5 hover:shadow-flottant', filtreInscription === 'inscrits' && 'ring-2 ring-emerald-500/30']" @click="filtreInscription = 'inscrits'">
            <div>
                <p class="text-[13px] font-medium text-gray-500">Inscrits à l’INSEC</p>
                <p class="mt-2 font-titre text-[1.75rem] leading-none font-bold tracking-tight text-gray-900 tabular-nums">{{ inscritsAnnee }}</p>
            </div>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-sm" aria-hidden="true"><i class="fa-solid fa-user-check text-sm"></i></span>
        </button>
        <button type="button" :class="['carte group flex cursor-pointer items-center justify-between p-5 text-left transition hover:-translate-y-0.5 hover:shadow-flottant', filtreInscription === 'non-actifs' && 'ring-2 ring-amber-500/30']" @click="filtreInscription = 'non-actifs'">
            <div>
                <p class="text-[13px] font-medium text-gray-500">Dossiers annuels à vérifier</p>
                <p class="mt-2 font-titre text-[1.75rem] leading-none font-bold tracking-tight text-gray-900 tabular-nums">{{ dossiersAverifierAnnee }}</p>
            </div>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-sm" aria-hidden="true"><i class="fa-solid fa-user-clock text-sm"></i></span>
        </button>
        <button type="button" :class="['carte group flex cursor-pointer items-center justify-between p-5 text-left transition hover:-translate-y-0.5 hover:shadow-flottant', filtreInscription === 'dossiers-annee' && 'ring-2 ring-insec-500/30']" @click="filtreInscription = 'dossiers-annee'">
            <div>
                <p class="text-[13px] font-medium text-gray-500">Étudiants suivis cette année</p>
                <p class="mt-2 font-titre text-[1.75rem] leading-none font-bold tracking-tight text-gray-900 tabular-nums">{{ etudiantsAvecDossierAnnee }}</p>
            </div>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-insec-500 to-insec-700 text-white shadow-sm" aria-hidden="true"><i class="fa-solid fa-users text-sm"></i></span>
        </button>
    </section>

    <div class="carte mb-4 flex flex-wrap items-center gap-2 p-3">
        <div class="relative min-w-[220px] flex-1">
            <i class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-gray-400"></i>
            <input v-model="recherche" type="search" placeholder="Rechercher un étudiant par nom ou e-mail…" class="champ pl-10" aria-label="Rechercher" />
        </div>
        <select v-model="formationId" class="champ w-auto" aria-label="Formation pour l’année sélectionnée">
            <option value="">Toutes les formations</option>
            <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.code }} · {{ f.nom }}</option>
        </select>
        <select v-model="filtreInscription" class="champ w-auto" aria-label="Filtrer par inscription">
            <option value="dossiers-annee">Dossiers de l’année</option>
            <option value="inscrits">Inscrits cette année</option>
            <option value="non-actifs">Dossiers annuels à vérifier</option>
            <option value="annuaire">Annuaire complet · toutes les années</option>
        </select>
    </div>
    <p class="mb-4 flex items-center gap-2 px-1 text-xs text-gray-500">
        <i class="fa-solid fa-circle-info text-gray-400"></i>
        La liste par défaut ne contient que les dossiers de l’année. L’annuaire conserve les étudiants des années précédentes.
    </p>

    <Chargement :chargement="chargement || chargementInscriptions" :erreur="erreur || erreurInscriptions">
        <section v-if="!etudiants.length" class="carte my-2 overflow-hidden">
            <div class="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-insec-500 to-insec-700 text-white shadow-lg">
                    <i class="fa-solid fa-users text-2xl" aria-hidden="true"></i>
                </div>
                <div>
                    <p class="surtitre">Démarrer le registre</p>
                    <h2 class="mt-1 font-titre text-xl font-bold text-gray-900">Aucun étudiant n’est encore enregistré</h2>
                    <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                        Créez le premier dossier et son inscription pour {{ libelleAnnee }}, ou importez votre registre avec le modèle INSEC.
                        Les années suivantes seront ajoutées au même dossier pour conserver tout l’historique.
                    </p>
                    <div class="mt-5 flex flex-wrap gap-3">
                        <RouterLink to="/etudiants/nouveau" class="bouton-action"><i class="fa-solid fa-plus text-xs"></i> Créer le premier dossier</RouterLink>
                        <RouterLink to="/excel" class="bouton-secondaire">
                            <i class="fa-solid fa-file-arrow-up text-xs" aria-hidden="true"></i>Importer le registre
                        </RouterLink>
                    </div>
                </div>
            </div>
            <div class="border-t border-gray-100 bg-gray-50/70 px-6 py-3 text-xs text-gray-500 sm:px-8">
                L’import Excel demande le modèle INSEC afin de conserver les liens entre étudiants et inscriptions annuelles.
            </div>
        </section>
        <section v-else-if="!filtres.length" class="carte my-2 flex flex-col items-center px-6 py-14 text-center">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>
            <h2 class="mt-3 font-semibold text-gray-900">{{ !etudiantsAvecDossierAnnee && filtreInscription !== 'annuaire' ? `Aucun dossier enregistré pour ${libelleAnnee}` : 'Aucun résultat pour ces critères' }}</h2>
            <p class="mt-1 text-sm text-gray-500">{{ !etudiantsAvecDossierAnnee && filtreInscription !== 'annuaire' ? 'Les étudiants des années précédentes restent dans l’annuaire complet.' : 'Changez l’année scolaire ou effacez la recherche et les filtres.' }}</p>
            <button v-if="!etudiantsAvecDossierAnnee && filtreInscription !== 'annuaire'" class="bouton-secondaire mt-5" @click="filtreInscription = 'annuaire'">Afficher l’annuaire complet</button>
            <button v-else class="bouton-secondaire mt-5" @click="effacerFiltres">Effacer la recherche et les filtres</button>
        </section>
        <div v-else class="carte overflow-x-auto">
            <table class="tableau">
                <thead><tr><th>Nom & prénom</th><th>E-mail</th><th>Formation cette année</th><th>Statut pour l’année</th><th>Situation</th><th class="text-right">Actions</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer" @click="router.push(`/etudiants/${e.id}`)">
                        <td>
                            <span class="flex items-center gap-3">
                                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec-50 text-[11px] font-bold text-insec-700 ring-1 ring-insec-100">{{ `${e.prenom?.[0] ?? ''}${e.nom?.[0] ?? ''}`.toUpperCase() }}</span>
                                <span class="font-semibold whitespace-nowrap text-gray-900">{{ e.nom }} {{ e.prenom }}</span>
                            </span>
                        </td>
                        <td class="text-gray-500">{{ e.email }}</td>
                        <td class="text-gray-600">
                            <template v-if="inscriptionsPour(e.id).length">
                                <span v-for="i in inscriptionsPour(e.id)" :key="i.id" class="mr-1 inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                    {{ formation(i.formationId)?.code ?? 'Formation inconnue' }}
                                </span>
                            </template>
                            <span v-else class="text-gray-300">—</span>
                        </td>
                        <td>
                            <span
                                :class="['pastille', situationInscription(e.id).inscrit
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'
                                    : situationInscription(e.id).aDossier
                                        ? 'bg-amber-50 text-amber-800 ring-amber-600/20'
                                        : 'bg-gray-50 text-gray-600 ring-gray-500/15']"
                            >
                                <span :class="['h-1.5 w-1.5 rounded-full', situationInscription(e.id).inscrit ? 'bg-emerald-500' : situationInscription(e.id).aDossier ? 'bg-amber-500' : 'bg-gray-400']"></span>
                                {{ situationInscription(e.id).inscrit ? 'Inscrit à l’INSEC' : situationInscription(e.id).aDossier ? 'Dossier à vérifier' : `Aucun dossier · ${libelleAnnee}` }}
                            </span>
                            <p v-if="situationInscription(e.id).detail" class="mt-1 text-xs text-gray-500">{{ situationInscription(e.id).detail }}</p>
                        </td>
                        <td><BadgeStatut :statut="e.statut" /></td>
                        <td class="text-right whitespace-nowrap" @click.stop>
                            <RouterLink :to="`/etudiants/${e.id}/modifier`" class="bouton-icone hover:bg-insec-50 hover:text-insec-700" title="Modifier" aria-label="Modifier"><i class="fa-solid fa-pen text-[13px]"></i></RouterLink>
                            <button class="bouton-icone hover:bg-red-50 hover:text-red-600" title="Supprimer" aria-label="Supprimer" @click="aSupprimer = e"><i class="fa-solid fa-trash text-[13px]"></i></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-if="filtres.length" v-model="page" :total="filtres.length" :par-page="PAR_PAGE" />
    </Chargement>

    <ModaleConfirmation
        :ouverte="!!aSupprimer"
        :envoi="envoi"
        :message="`Voulez-vous vraiment supprimer ${aSupprimer?.nom} ${aSupprimer?.prenom} ? Cette action est irréversible.`"
        @annuler="aSupprimer = null"
        @confirmer="supprimer"
    />
</template>
