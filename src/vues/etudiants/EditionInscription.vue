<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import ChampsInscription, { type ValeursInscription } from '../../composants/ChampsInscription.vue';
import { useDocument } from '../../donnees';
import { aujourdhui, nomComplet } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import type { Etudiant, Inscription } from '../../types';

const props = defineProps<{ etudiantId?: string; inscriptionId?: string }>();
const router = useRouter();
const modification = computed(() => !!props.inscriptionId);
const { donnee: inscription, chargement: chargementInscription } = useDocument<Inscription>(() => (props.inscriptionId ? `inscriptions/${props.inscriptionId}` : null));
const idEtudiant = computed(() => props.etudiantId ?? inscription.value?.etudiantId ?? null);
const { donnee: etudiant, chargement: chargementEtudiant } = useDocument<Etudiant>(() => (idEtudiant.value ? `etudiants/${idEtudiant.value}` : null));

const valeurs = ref<ValeursInscription | null>(props.inscriptionId ? null : {
    formationId: '', anneeId: '', anneeParcours: '', dateInscription: aujourdhui(), numeroIntec: '', ueIds: [],
});
watch(inscription, (i) => {
    if (i && !valeurs.value) {
        valeurs.value = {
            formationId: i.formationId, anneeId: i.anneeId, anneeParcours: i.anneeParcours, dateInscription: i.dateInscription,
            numeroIntec: i.numeroIntec ?? '', statut: i.statut, ueIds: [...i.ueIds],
        };
    }
}, { immediate: true });

const { envoi, erreurs, soumettre } = useFormulaire();
async function enregistrer() {
    const resultat = await soumettre(() => modification.value
        ? appeler('modifierInscription', { id: props.inscriptionId, ...valeurs.value })
        : appeler('creerInscription', { etudiantId: props.etudiantId, ...valeurs.value }));
    if (!resultat) return;
    notifier(resultat.message ?? 'Inscription enregistrée.', { apresNavigation: true });
    await router.push(`/etudiants/${idEtudiant.value}`);
}
</script>

<template>
    <div class="max-w-4xl">
        <RouterLink v-if="idEtudiant" :to="`/etudiants/${idEtudiant}`" class="text-sm text-gray-500">← Retour à la fiche</RouterLink>
        <h1 class="mt-2 text-xl font-bold text-insec">{{ modification ? 'Modifier l’inscription' : 'Nouvelle inscription' }}</h1>
        <p class="mb-5 text-gray-600">{{ nomComplet(etudiant) }}</p>
        <Chargement :chargement="chargementInscription || chargementEtudiant" :vide="!etudiant" message-vide="Dossier introuvable.">
            <form v-if="valeurs" class="carte space-y-5 p-6" @submit.prevent="enregistrer">
                <ChampsInscription v-model="valeurs" :erreurs="erreurs" :avec-statut="modification" />
                <p v-if="!modification" class="text-sm text-gray-500">L’historique des inscriptions précédentes est conservé.</p>
                <button class="bouton-action" :disabled="envoi">Enregistrer l’inscription</button>
            </form>
        </Chargement>
    </div>
</template>
