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
    <div class="mx-auto max-w-3xl">
        <RouterLink :to="`/etudiants/${id}`" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à la fiche</RouterLink>
        <header class="en-tete-page">
            <div>
                <p class="surtitre">Dossier étudiant</p>
                <h1 class="titre-page mt-1.5">Modifier l’identité</h1>
                <p class="sous-titre">Les inscriptions et l’historique financier ne sont pas modifiés.</p>
            </div>
        </header>
        <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
            <form v-if="identite" class="space-y-6" @submit.prevent="enregistrer">
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
                    </div>
                </section>
                <div class="flex flex-wrap items-center justify-end gap-3">
                    <RouterLink :to="`/etudiants/${id}`" class="bouton-secondaire">Annuler</RouterLink>
                    <button class="bouton-action" :disabled="envoi"><i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>Enregistrer</button>
                </div>
            </form>
        </Chargement>
    </div>
</template>
