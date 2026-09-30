<script setup lang="ts">
import { useRouter } from 'vue-router';
import { accueil, deconnexion, session } from '../session';
import { useAlertesNonLues } from './alertesNonLues';

const router = useRouter();
const nonLues = useAlertesNonLues();

async function quitter() {
    await deconnexion();
    await router.push('/connexion');
}
</script>

<template>
    <header class="flex flex-wrap items-center justify-between gap-3 bg-insec px-6 py-4 text-white">
        <RouterLink :to="accueil()">
            <strong class="text-xl">INSEC</strong>
            <span class="ml-3 text-blue-200">{{ session.role === 'etudiant' ? 'Espace étudiant' : 'Espace enseignant' }}</span>
        </RouterLink>
        <div class="flex items-center gap-3">
            <RouterLink to="/alertes" class="rounded bg-white/10 px-3 py-2 text-sm">
                <i class="fa-solid fa-bell mr-1"></i> Alertes
                <span v-if="nonLues" class="ml-1 rounded-full bg-red-500 px-2 py-0.5">{{ nonLues }}</span>
            </RouterLink>
            <button class="cursor-pointer rounded bg-white/10 px-3 py-2 text-sm" @click="quitter">Déconnexion</button>
        </div>
    </header>
</template>
