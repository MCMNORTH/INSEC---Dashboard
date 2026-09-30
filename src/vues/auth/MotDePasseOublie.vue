<script setup lang="ts">
import { ref } from 'vue';
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
    <div class="flex min-h-screen items-center justify-center bg-[#f0f2f5] p-5">
        <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h1 class="mb-1 text-2xl font-bold text-insec">Mot de passe oublié</h1>
            <p class="mb-5 text-sm text-gray-500">Indiquez votre adresse e-mail : un lien sécurisé de réinitialisation vous sera envoyé.</p>
            <div v-if="envoye" role="status" class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé.
            </div>
            <div v-if="erreur" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ erreur }}</div>
            <form class="space-y-4" @submit.prevent="envoyer">
                <label class="etiquette">Adresse e-mail
                    <input v-model="email" type="email" autocomplete="username" class="champ mt-1" required autofocus />
                </label>
                <button class="bouton-principal w-full py-2.5" :disabled="envoi">Envoyer le lien</button>
            </form>
            <RouterLink to="/connexion" class="mt-5 inline-block text-sm text-insec hover:underline">← Retour à la connexion</RouterLink>
        </div>
    </div>
</template>
