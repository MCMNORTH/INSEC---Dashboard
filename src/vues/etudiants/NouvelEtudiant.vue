<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import ChampsIdentite, { type Identite } from '../../composants/ChampsIdentite.vue';
import ChampsInscription, { type ValeursInscription } from '../../composants/ChampsInscription.vue';
import { aujourdhui } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';

const router = useRouter();
const { envoi, erreurs, soumettre } = useFormulaire();
const identite = ref<Identite>({ nom: '', prenom: '', email: '', telephone: '', statut: 'Actif' });
const inscription = ref<ValeursInscription>({ formationId: '', anneeId: '', anneeParcours: '', dateInscription: aujourdhui(), numeroIntec: '', ueIds: [] });

async function enregistrer() {
    const resultat = await soumettre(() => appeler<{ id: string; message: string }>('creerEtudiant', { ...identite.value, ...inscription.value }));
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
            </section>
            <section class="border-t pt-5">
                <h2 class="mb-3 font-semibold text-insec">Inscription</h2>
                <ChampsInscription v-model="inscription" :erreurs="erreurs" />
            </section>
            <button class="bouton-action" :disabled="envoi">Enregistrer l’étudiant</button>
        </form>
    </div>
</template>
