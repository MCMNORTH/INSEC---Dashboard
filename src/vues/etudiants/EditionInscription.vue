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
    formationId: '', anneeId: '', anneeParcours: '', dateInscription: aujourdhui(), numeroIntec: '', financeur: 'etudiant', ueIds: [],
});
watch(inscription, (i) => {
    if (i && !valeurs.value) {
        valeurs.value = {
            formationId: i.formationId, anneeId: i.anneeId, anneeParcours: i.anneeParcours, dateInscription: i.dateInscription,
            numeroIntec: i.numeroIntec ?? '', statut: i.statut, financeur: i.financeur ?? 'etudiant', ueIds: [...i.ueIds],
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
    <div class="mx-auto max-w-4xl">
        <RouterLink v-if="idEtudiant" :to="`/etudiants/${idEtudiant}`" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à la fiche</RouterLink>
        <header class="en-tete-page">
            <div>
                <p class="surtitre">{{ nomComplet(etudiant) }}</p>
                <h1 class="titre-page mt-1.5">{{ modification ? 'Modifier l’inscription' : 'Nouvelle inscription' }}</h1>
                <p v-if="!modification" class="sous-titre">L’historique des inscriptions précédentes est conservé.</p>
            </div>
        </header>
        <Chargement :chargement="chargementInscription || chargementEtudiant" :vide="!etudiant" message-vide="Dossier introuvable.">
            <form v-if="valeurs" class="space-y-6" @submit.prevent="enregistrer">
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
                        <ChampsInscription v-model="valeurs" :erreurs="erreurs" :avec-statut="modification" />
                    </div>
                </section>
                <div class="flex flex-wrap items-center justify-end gap-3">
                    <RouterLink v-if="idEtudiant" :to="`/etudiants/${idEtudiant}`" class="bouton-secondaire">Annuler</RouterLink>
                    <button class="bouton-action" :disabled="envoi"><i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>Enregistrer l’inscription</button>
                </div>
            </form>
        </Chargement>
    </div>
</template>
