<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { collection, orderBy, query } from 'firebase/firestore';
import { appeler } from '../../api';
import ChampsIdentite, { type Identite } from '../../composants/ChampsIdentite.vue';
import ChampsInscription, { type ValeursInscription } from '../../composants/ChampsInscription.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import type { Etudiant } from '../../types';

const router = useRouter();
const { envoi, erreurs, soumettre } = useFormulaire();
const identite = ref<Identite>({ nom: '', prenom: '', email: '', dateNaissance: '', telephone: '', statut: 'Actif' });
const inscription = ref<ValeursInscription>({ formationId: '', anneeId: '', anneeParcours: '', dateInscription: '', numeroIntec: '', financeur: 'etudiant', ueIds: [] });
const noteFinanciere = ref('');
const { donnees: annuaire, chargement: chargementAnnuaire, erreur: erreurAnnuaire } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const normaliser = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const correspondances = computed(() => {
    const nom = normaliser(`${identite.value.nom} ${identite.value.prenom}`);
    if (!nom) return [];
    return annuaire.value.filter((e) => normaliser(`${e.nom} ${e.prenom}`) === nom);
});
const confirmerHomonyme = ref(false);

async function enregistrer() {
    if (chargementAnnuaire.value || erreurAnnuaire.value) {
        notifier('L’annuaire ne peut pas être vérifié maintenant. Réessayez avant de créer un étudiant.');
        return;
    }
    if (correspondances.value.length && !confirmerHomonyme.value) {
        notifier('Un étudiant portant déjà ce nom existe. Ouvrez sa fiche pour ajouter une inscription, ou confirmez qu’il s’agit d’un homonyme.');
        return;
    }
    const resultat = await soumettre(() => appeler<{ id: string; message: string }>('creerEtudiant', { ...identite.value, ...inscription.value, noteFinanciere: noteFinanciere.value }));
    if (!resultat) return;
    notifier(resultat.message, { apresNavigation: true });
    await router.push(`/etudiants/${resultat.id}`);
}
</script>

<template>
    <div class="mx-auto max-w-4xl">
        <RouterLink to="/etudiants" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à la liste</RouterLink>
        <header class="en-tete-page">
            <div>
                <p class="surtitre">Registre INSEC</p>
                <h1 class="titre-page mt-1.5">Nouvel étudiant et première inscription</h1>
                <p class="sous-titre">Renseignez l’identité puis l’inscription de l’année. L’annuaire est vérifié pour éviter les doublons.</p>
            </div>
        </header>
        <form class="space-y-6" @submit.prevent="enregistrer">
            <section class="carte overflow-hidden">
                <header class="panneau-entete">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-id-card text-sm"></i></span>
                        <div>
                            <h2 class="titre-section">Identité</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Nom, coordonnées et statut de l’étudiant.</p>
                        </div>
                    </div>
                </header>
                <div class="p-5 sm:p-6">
                    <ChampsIdentite v-model="identite" :erreurs="erreurs" />
                    <p v-if="erreurAnnuaire" role="alert" class="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-800">
                        <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>
                        <span>Impossible de vérifier les doublons dans l’annuaire : {{ erreurAnnuaire }}</span>
                    </p>
                    <div v-if="correspondances.length" class="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4" role="alert">
                        <p class="flex items-center gap-2 font-semibold text-amber-950">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
                            {{ correspondances.length }} correspondance(s) trouvée(s) dans l’annuaire
                        </p>
                        <ul class="mt-3 space-y-2 text-sm">
                            <li v-for="e in correspondances" :key="e.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-amber-100">
                                <span class="text-gray-900">{{ e.prenom }} {{ e.nom }} <span class="text-gray-500">· {{ e.email || 'sans e-mail' }}</span></span>
                                <RouterLink :to="`/etudiants/${e.id}`" class="lien">Ouvrir la fiche et ajouter une inscription</RouterLink>
                            </li>
                        </ul>
                        <label class="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-amber-950">
                            <input v-model="confirmerHomonyme" type="checkbox" class="mt-0.5" />
                            Il s’agit d’un homonyme différent ; confirmer la création d’une nouvelle fiche.
                        </label>
                    </div>
                </div>
            </section>
            <section class="carte overflow-hidden">
                <header class="panneau-entete">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-graduation-cap text-sm"></i></span>
                        <div>
                            <h2 class="titre-section">Inscription</h2>
                            <p class="mt-0.5 text-xs text-gray-500">Diplôme, année scolaire et UE suivies.</p>
                        </div>
                    </div>
                </header>
                <div class="p-5 sm:p-6">
                    <ChampsInscription v-model="inscription" :erreurs="erreurs" />
                    <label class="etiquette mt-6 block">Note financière <span class="font-normal text-gray-400">(facultative)</span>
                        <textarea v-model="noteFinanciere" class="champ mt-1.5 min-h-20" maxlength="2000" />
                        <span v-if="erreurs.noteFinanciere" class="mt-1 block text-xs text-red-600">{{ erreurs.noteFinanciere }}</span>
                    </label>
                </div>
            </section>
            <div class="flex flex-wrap items-center justify-end gap-3">
                <RouterLink to="/etudiants" class="bouton-secondaire">Annuler</RouterLink>
                <button class="bouton-action" :disabled="envoi || chargementAnnuaire || (correspondances.length > 0 && !confirmerHomonyme)">
                    <i v-if="envoi || chargementAnnuaire" class="fa-solid fa-circle-notch fa-spin"></i>
                    {{ chargementAnnuaire ? 'Chargement de l’annuaire…' : 'Enregistrer l’étudiant' }}
                </button>
            </div>
        </form>
    </div>
</template>
