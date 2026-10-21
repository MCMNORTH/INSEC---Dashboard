<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import ChampsIdentite, { type Identite } from '../../composants/ChampsIdentite.vue';
import { useDocument } from '../../donnees';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import type { Etudiant } from '../../types';

const props = defineProps<{ id: string }>();
const router = useRouter();
const { donnee: etudiant, chargement } = useDocument<Etudiant>(() => `etudiants/${props.id}`);
const identite = ref<Identite | null>(null);
watch(etudiant, (e) => {
    if (e && !identite.value) identite.value = { nom: e.nom, prenom: e.prenom, email: e.email ?? '', dateNaissance: e.dateNaissance ?? '', telephone: e.telephone ?? '', statut: e.statut };
}, { immediate: true });
const { envoi, erreurs, soumettre } = useFormulaire();

async function enregistrer() {
    const resultat = await soumettre(() => appeler('modifierEtudiant', { id: props.id, ...identite.value }));
    if (!resultat) return;
    notifier(resultat.message ?? 'Identité mise à jour.', { apresNavigation: true });
    await router.push(`/etudiants/${props.id}`);
}
</script>

<template>
    <div class="max-w-3xl">
        <RouterLink :to="`/etudiants/${id}`" class="text-sm text-gray-500">← Retour à la fiche</RouterLink>
        <h1 class="mt-2 mb-1 text-xl font-bold text-insec">Modifier l’identité</h1>
        <p class="mb-5 text-sm text-gray-500">Les inscriptions et l’historique financier ne sont pas modifiés.</p>
        <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
            <form v-if="identite" class="carte space-y-5 p-6" @submit.prevent="enregistrer">
                <ChampsIdentite v-model="identite" :erreurs="erreurs" />
                <button class="bouton-action" :disabled="envoi">Enregistrer</button>
            </form>
        </Chargement>
    </div>
</template>
