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
const filtreInscription = ref<'tous' | 'inscrits' | 'non-inscrits'>(
    route.query.inscription === 'inscrits' || route.query.inscription === 'non-inscrits' ? route.query.inscription : 'tous',
);
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
    if (inscription === 'tous' || inscription === 'inscrits' || inscription === 'non-inscrits') {
        filtreInscription.value = inscription;
    }
});

const normaliser = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const inscriptionsPour = (etudiantId: string) =>
    inscriptions.value.filter((i) => i.etudiantId === etudiantId && i.anneeId === anneeId.value);
const estInscritCetteAnnee = (etudiantId: string) =>
    inscriptionsPour(etudiantId).some((i) => i.statut === 'active');
const situationInscription = (etudiantId: string) => {
    const inscriptionsAnnee = inscriptionsPour(etudiantId);
    const inscrit = inscriptionsAnnee.some((i) => i.statut === 'active');
    const libelles: Record<string, string> = {
        suspendue: 'Inscription suspendue',
        annulée: 'Inscription annulée',
        terminée: 'Inscription terminée',
    };
    const detail = inscrit || !inscriptionsAnnee.length
        ? null
        : [...new Set(inscriptionsAnnee.map((i) => libelles[i.statut] ?? 'Inscription non active'))].join(' · ');
    return { inscrit, detail };
};

const filtres = computed(() => {
    const terme = normaliser(recherche.value.trim());
    return etudiants.value.filter((e) => {
        const inscriptionsAnnee = inscriptionsPour(e.id);
        const inscrit = inscriptionsAnnee.some((i) => i.statut === 'active');
        return (!terme || [e.nom, e.prenom, e.email].some((v) => normaliser(v ?? '').includes(terme)))
            && (!formationId.value || inscriptionsAnnee.some((i) => i.formationId === formationId.value))
            && (filtreInscription.value === 'tous'
                || (filtreInscription.value === 'inscrits' && inscrit)
                || (filtreInscription.value === 'non-inscrits' && !inscrit));
    });
});
const affiches = computed(() => filtres.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE));
const inscritsAnnee = computed(() => etudiants.value.filter((e) => estInscritCetteAnnee(e.id)).length);
const nonInscritsAnnee = computed(() => etudiants.value.length - inscritsAnnee.value);
const libelleAnnee = computed(() => annees.value.find((a) => a.id === anneeId.value)?.libelle ?? 'année sélectionnée');
watch([recherche, formationId, filtreInscription, anneeId], () => (page.value = 1));

function effacerFiltres() {
    recherche.value = '';
    formationId.value = '';
    filtreInscription.value = 'tous';
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
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <p class="text-sm text-gray-500">Registre INSEC</p>
            <h1 class="text-xl font-bold text-insec">Étudiants</h1>
            <p class="mt-1 text-sm text-gray-500">Vérifiez l’inscription à l’INSEC pour chaque année scolaire. L’historique reste sur la fiche de l’étudiant.</p>
        </div>
        <RouterLink to="/etudiants/nouveau" class="bouton-action">+ Nouvel étudiant</RouterLink>
    </div>

    <section class="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Résumé des inscriptions">
        <article class="carte flex items-center justify-between p-4">
            <div><p class="text-sm text-gray-500">Inscrits à l’INSEC</p><p class="mt-1 text-2xl font-semibold text-emerald-700">{{ inscritsAnnee }}</p></div>
            <i class="fa-solid fa-user-check rounded-xl bg-emerald-50 p-3 text-emerald-700" aria-hidden="true"></i>
        </article>
        <article class="carte flex items-center justify-between p-4">
            <div><p class="text-sm text-gray-500">Non inscrits cette année</p><p class="mt-1 text-2xl font-semibold text-gray-700">{{ nonInscritsAnnee }}</p></div>
            <i class="fa-solid fa-user-minus rounded-xl bg-gray-100 p-3 text-gray-600" aria-hidden="true"></i>
        </article>
        <article class="carte flex items-center justify-between p-4">
            <div><p class="text-sm text-gray-500">Dossiers au registre</p><p class="mt-1 text-2xl font-semibold text-insec">{{ etudiants.length }}</p></div>
            <i class="fa-solid fa-users rounded-xl bg-blue-50 p-3 text-blue-700" aria-hidden="true"></i>
        </article>
    </section>

    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-sm text-gray-600">
            <span>Année scolaire</span>
            <select v-model="anneeId" class="champ w-auto" aria-label="Année scolaire">
                <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
            </select>
        </label>
        <p class="text-xs text-gray-500">« Non inscrit » signifie qu’aucune inscription active n’existe pour l’année sélectionnée.</p>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
        <input v-model="recherche" type="search" placeholder="Rechercher un étudiant…" class="champ min-w-[200px] flex-1" aria-label="Rechercher" />
        <select v-model="formationId" class="champ w-auto" aria-label="Formation pour l’année sélectionnée">
            <option value="">Toutes les formations</option>
            <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.code }} · {{ f.nom }}</option>
        </select>
        <select v-model="filtreInscription" class="champ w-auto" aria-label="Filtrer par inscription">
            <option value="tous">Tous les étudiants</option>
            <option value="inscrits">Inscrits cette année</option>
            <option value="non-inscrits">Non inscrits cette année</option>
        </select>
    </div>

    <Chargement :chargement="chargement || chargementInscriptions" :erreur="erreur || erreurInscriptions">
        <section v-if="!etudiants.length" class="carte my-2 overflow-hidden">
            <div class="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-insec">
                    <i class="fa-solid fa-users text-2xl" aria-hidden="true"></i>
                </div>
                <div>
                    <p class="text-sm font-semibold uppercase tracking-wide text-insec">Démarrer le registre</p>
                    <h2 class="mt-1 text-xl font-bold text-gray-900">Aucun étudiant n’est encore enregistré</h2>
                    <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                        Créez le premier dossier et son inscription pour {{ libelleAnnee }}, ou importez votre registre avec le modèle INSEC.
                        Les années suivantes seront ajoutées au même dossier pour conserver tout l’historique.
                    </p>
                    <div class="mt-5 flex flex-wrap gap-3">
                        <RouterLink to="/etudiants/nouveau" class="bouton-action">+ Créer le premier dossier</RouterLink>
                        <RouterLink to="/excel" class="bouton border border-gray-200 bg-white text-insec hover:bg-gray-50">
                            <i class="fa-solid fa-file-arrow-up mr-2" aria-hidden="true"></i>Importer le registre
                        </RouterLink>
                    </div>
                </div>
            </div>
            <div class="border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500 sm:px-8">
                L’import Excel demande le modèle INSEC afin de conserver les liens entre étudiants et inscriptions annuelles.
            </div>
        </section>
        <section v-else-if="!filtres.length" class="carte my-2 flex flex-col items-center px-6 py-12 text-center">
            <i class="fa-solid fa-magnifying-glass mb-4 text-2xl text-gray-400" aria-hidden="true"></i>
            <h2 class="font-semibold text-gray-800">Aucun résultat pour ces critères</h2>
            <p class="mt-1 text-sm text-gray-500">Changez l’année scolaire ou effacez la recherche et les filtres.</p>
            <button class="mt-4 cursor-pointer text-sm font-semibold text-insec underline" @click="effacerFiltres">Effacer la recherche et les filtres</button>
        </section>
        <div v-else class="overflow-x-auto rounded-xl bg-white shadow">
            <table class="tableau">
                <thead><tr><th>Nom & prénom</th><th>E-mail</th><th>Formation cette année</th><th>Statut pour l’année</th><th>Situation</th><th class="text-right">Actions</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer hover:bg-gray-50" @click="router.push(`/etudiants/${e.id}`)">
                        <td class="font-medium text-gray-800">{{ e.nom }} {{ e.prenom }}</td>
                        <td class="text-gray-600">{{ e.email }}</td>
                        <td class="text-gray-600">
                            <template v-if="inscriptionsPour(e.id).length">
                                <span v-for="(i, index) in inscriptionsPour(e.id)" :key="i.id">
                                    {{ index ? ', ' : '' }}{{ formation(i.formationId)?.code ?? 'Formation inconnue' }}
                                </span>
                            </template>
                            <span v-else class="text-gray-400">—</span>
                        </td>
                        <td>
                            <span
                                :class="situationInscription(e.id).inscrit
                                    ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800'
                                    : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700'"
                            >{{ situationInscription(e.id).inscrit ? 'Inscrit à l’INSEC' : 'Non inscrit à l’INSEC' }}</span>
                            <p v-if="situationInscription(e.id).detail" class="mt-1 text-xs text-gray-500">{{ situationInscription(e.id).detail }}</p>
                        </td>
                        <td><BadgeStatut :statut="e.statut" /></td>
                        <td class="text-right whitespace-nowrap" @click.stop>
                            <RouterLink :to="`/etudiants/${e.id}/modifier`" class="mr-3 text-gray-400 hover:text-blue-600" title="Modifier"><i class="fa-solid fa-pen"></i></RouterLink>
                            <button class="cursor-pointer text-gray-400 hover:text-red-600" title="Supprimer" @click="aSupprimer = e"><i class="fa-solid fa-trash"></i></button>
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
