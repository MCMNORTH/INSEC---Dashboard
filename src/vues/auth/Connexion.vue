<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { accueil, connexion, deconnexion, messageAuth, session } from '../../session';

const route = useRoute();
const router = useRouter();
const email = ref('');
const motDePasse = ref('');
const erreur = ref(session.messageDeconnexion);
const envoi = ref(false);

async function seConnecter() {
    envoi.value = true;
    erreur.value = '';
    try {
        await connexion(email.value, motDePasse.value);
        if (!session.role) {
            await deconnexion();
            erreur.value = 'Aucun rôle n’est attribué à ce compte. Contactez l’administration.';
            return;
        }
        const redirection = typeof route.query.redirection === 'string' && route.query.redirection.startsWith('/') ? route.query.redirection : null;
        await router.replace(redirection ?? accueil());
    } catch (e) {
        erreur.value = messageAuth(e);
    } finally {
        envoi.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-[#f0f2f5] p-5">
        <div class="grid w-full max-w-[950px] overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-12">
            <div class="flex flex-col justify-center bg-gradient-to-br from-insec to-[#293241] p-10 text-center text-white md:col-span-5">
                <img src="/images/logo-insec-2026.png" alt="Logo INSEC" class="mx-auto mb-4 block h-auto max-h-36 w-full max-w-[260px] object-contain" />
                <h1 class="mb-3 text-2xl font-bold">ESPACE INSEC</h1>
                <p class="mb-6 text-sm opacity-80">Gérez votre tableau de bord et vos accès en toute sécurité.</p>
                <div class="rounded border border-white/60 bg-white/10 p-3">
                    <span class="text-xs font-bold tracking-wider text-insec-or uppercase">Plateforme officielle</span>
                </div>
            </div>
            <div class="flex flex-col justify-center p-10 md:col-span-7">
                <h2 class="mb-1 text-2xl font-bold text-insec">Connexion</h2>
                <p class="mb-4 text-sm text-gray-500">Entrez vos identifiants pour continuer</p>
                <div v-if="erreur" role="alert" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ erreur }}</div>
                <form class="space-y-4" @submit.prevent="seConnecter">
                    <label class="etiquette">Adresse e-mail
                        <input v-model="email" type="email" autocomplete="username" class="champ mt-1" required autofocus />
                    </label>
                    <label class="etiquette">Mot de passe
                        <input v-model="motDePasse" type="password" autocomplete="current-password" class="champ mt-1" required />
                    </label>
                    <div class="text-right">
                        <RouterLink to="/mot-de-passe-oublie" class="text-xs text-insec hover:underline">Mot de passe oublié ?</RouterLink>
                    </div>
                    <button class="bouton-principal w-full py-2.5" :disabled="envoi">
                        <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i> Se connecter
                    </button>
                    <RouterLink to="/admission" class="bouton-secondaire w-full py-2.5">Déposer une candidature</RouterLink>
                </form>
            </div>
        </div>
    </div>
</template>
