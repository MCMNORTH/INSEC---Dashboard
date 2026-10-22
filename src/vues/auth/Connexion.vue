<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EcranAccueil from '../../composants/EcranAccueil.vue';
import { accueil, connexion, deconnexion, messageAuth, session } from '../../session';

const route = useRoute();
const router = useRouter();
const email = ref('');
const motDePasse = ref('');
const visible = ref(false);
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
    <EcranAccueil titre="Bon retour parmi nous" sous-titre="Connectez-vous à l’espace de gestion de l’INSEC.">
        <div v-if="erreur" role="alert" class="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-800">
            <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>
            <span>{{ erreur }}</span>
        </div>
        <form class="space-y-5" @submit.prevent="seConnecter">
            <label class="etiquette">Adresse e-mail
                <span class="relative mt-1.5 block">
                    <i class="fa-regular fa-envelope pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-400"></i>
                    <input v-model="email" type="email" autocomplete="username" class="champ h-11 pl-10" placeholder="prenom.nom@insec.mr" required autofocus />
                </span>
            </label>
            <label class="etiquette">
                <span class="flex items-center justify-between">
                    Mot de passe
                    <RouterLink to="/mot-de-passe-oublie" class="lien text-xs">Mot de passe oublié ?</RouterLink>
                </span>
                <span class="relative mt-1.5 block">
                    <i class="fa-solid fa-lock pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-gray-400"></i>
                    <input v-model="motDePasse" :type="visible ? 'text' : 'password'" autocomplete="current-password" class="champ h-11 pr-11 pl-10" required />
                    <button
                        type="button"
                        class="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                        :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                        @click="visible = !visible"
                    >
                        <i :class="['fa-regular text-[13px]', visible ? 'fa-eye-slash' : 'fa-eye']"></i>
                    </button>
                </span>
            </label>
            <button class="bouton-principal h-11 w-full text-[15px]" :disabled="envoi">
                <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>
                Se connecter
                <i v-if="!envoi" class="fa-solid fa-arrow-right text-xs opacity-70"></i>
            </button>
        </form>
        <p class="mt-8 flex items-center gap-2 text-xs text-gray-400">
            <i class="fa-solid fa-shield-halved"></i>
            Accès réservé à l’équipe INSEC. Connexion chiffrée.
        </p>
    </EcranAccueil>
</template>
