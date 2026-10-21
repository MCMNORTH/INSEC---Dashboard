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
    <div class="max-w-4xl">
        <RouterLink to="/etudiants" class="text-sm text-gray-500">← Retour à la liste</RouterLink>
        <h1 class="mt-2 mb-5 text-xl font-bold text-insec">Nouvel étudiant et première inscription</h1>
        <form class="carte space-y-6 p-6" @submit.prevent="enregistrer">
            <section>
                <h2 class="mb-3 font-semibold text-insec">Identité</h2>
                <ChampsIdentite v-model="identite" :erreurs="erreurs" />
                <p v-if="erreurAnnuaire" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">Impossible de vérifier les doublons dans l’annuaire : {{ erreurAnnuaire }}</p>
                <div v-if="correspondances.length" class="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4" role="alert">
                    <p class="font-semibold text-amber-950">{{ correspondances.length }} correspondance(s) trouvée(s) dans l’annuaire</p>
                    <ul class="mt-2 space-y-2 text-sm">
                        <li v-for="e in correspondances" :key="e.id" class="flex flex-wrap items-center justify-between gap-2">
                            <span>{{ e.prenom }} {{ e.nom }} <span class="text-gray-600">· {{ e.email || 'sans e-mail' }}</span></span>
                            <RouterLink :to="`/etudiants/${e.id}`" class="font-medium text-insec underline">Ouvrir la fiche et ajouter une inscription</RouterLink>
                        </li>
                    </ul>
                    <label class="mt-3 flex items-start gap-2 text-sm text-amber-950">
                        <input v-model="confirmerHomonyme" type="checkbox" class="mt-1" />
                        Il s’agit d’un homonyme différent ; confirmer la création d’une nouvelle fiche.
                    </label>
                </div>
            </section>
            <section class="border-t pt-5">
                <h2 class="mb-3 font-semibold text-insec">Inscription</h2>
                <ChampsInscription v-model="inscription" :erreurs="erreurs" />
                <label class="etiquette mt-4 block">Note financière <span class="text-gray-400">(facultative)</span>
                    <textarea v-model="noteFinanciere" class="champ mt-1 min-h-20" maxlength="2000" />
                    <span v-if="erreurs.noteFinanciere" class="text-xs text-red-600">{{ erreurs.noteFinanciere }}</span>
                </label>
            </section>
            <button class="bouton-action" :disabled="envoi || chargementAnnuaire || (correspondances.length > 0 && !confirmerHomonyme)">{{ chargementAnnuaire ? 'Chargement de l’annuaire…' : 'Enregistrer l’étudiant' }}</button>
        </form>
    </div>
</template>
