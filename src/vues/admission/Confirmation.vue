<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { appeler, messageErreur } from '../../api';

const props = defineProps<{ reference: string }>();
const email = ref('');
const erreur = ref('');

onMounted(async () => {
    try {
        email.value = (await appeler<{ email: string }>('confirmationCandidature', { reference: props.reference })).email;
    } catch (e) {
        erreur.value = messageErreur(e);
    }
});
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <main class="max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
            <template v-if="erreur">
                <h1 class="text-2xl font-bold text-insec">Candidature introuvable</h1>
                <p class="mt-2 text-gray-500">{{ erreur }}</p>
            </template>
            <template v-else>
                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</div>
                <h1 class="mt-5 text-2xl font-bold text-insec">Candidature bien reçue</h1>
                <p class="mt-2 text-gray-500">Conservez cette référence pour vos échanges avec l’INSEC.</p>
                <div class="my-6 rounded-xl border bg-gray-50 p-4">
                    <p class="text-xs text-gray-400 uppercase">Référence</p>
                    <p class="mt-1 font-mono text-xl font-bold text-insec">{{ reference }}</p>
                </div>
                <p v-if="email" class="text-sm text-gray-500">Un retour sera envoyé à <strong>{{ email }}</strong> après étude du dossier.</p>
            </template>
            <RouterLink to="/connexion" class="mt-6 inline-block font-semibold text-insec">Retour à l’accueil</RouterLink>
        </main>
    </div>
</template>
