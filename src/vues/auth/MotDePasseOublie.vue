<script setup lang="ts">
import { ref } from 'vue';
import EcranAccueil from '../../composants/EcranAccueil.vue';
import { envoyerLienReinitialisation, messageAuth } from '../../session';

const email = ref('');
const envoye = ref(false);
const erreur = ref('');
const envoi = ref(false);

async function envoyer() {
    envoi.value = true;
    erreur.value = '';
    try {
        await envoyerLienReinitialisation(email.value);
        envoye.value = true;
    } catch (e) {
        // Aucune indication sur l'existence du compte, sauf erreur technique.
        if ((e as { code?: string }).code === 'auth/user-not-found') envoye.value = true;
        else erreur.value = messageAuth(e);
    } finally {
        envoi.value = false;
    }
}
</script>

<template>
    <EcranAccueil titre="Mot de passe oublié" sous-titre="Indiquez votre adresse e-mail : un lien sécurisé de réinitialisation vous sera envoyé.">
        <div v-if="envoye" role="status" class="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm text-emerald-800">
            <i class="fa-solid fa-circle-check mt-0.5 text-emerald-500"></i>
            <span>Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé.</span>
        </div>
        <div v-if="erreur" role="alert" class="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-800">
            <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>
            <span>{{ erreur }}</span>
        </div>
        <form class="space-y-5" @submit.prevent="envoyer">
            <label class="etiquette">Adresse e-mail
                <span class="relative mt-1.5 block">
                    <i class="fa-regular fa-envelope pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400"></i>
                    <input v-model="email" type="email" autocomplete="username" class="champ h-11 pl-10" required autofocus />
                </span>
            </label>
            <button class="bouton-principal h-11 w-full text-[15px]" :disabled="envoi">
                <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>
                Envoyer le lien
            </button>
        </form>
        <RouterLink to="/connexion" class="lien mt-8 inline-flex items-center gap-2 text-sm">
            <i class="fa-solid fa-arrow-left text-xs"></i> Retour à la connexion
        </RouterLink>
    </EcranAccueil>
</template>
