<script setup lang="ts">
import MarqueInsec from '../composants/MarqueInsec.vue';
</script>

<template>
    <div class="flex min-h-screen flex-col items-center justify-center bg-[#f5f6fb] bg-[radial-gradient(60%_40%_at_50%_0%,var(--color-insec-50),transparent)] p-6">
        <div class="w-full max-w-lg animate-apparition text-center">
            <MarqueInsec />
            <p class="mt-12 bg-linear-to-br from-insec-400 to-insec-950 bg-clip-text font-titre text-[7rem] leading-none font-extrabold tracking-tighter text-transparent">404</p>
            <h1 class="mt-4 font-titre text-2xl font-bold tracking-tight text-gray-900">Page introuvable</h1>
            <p class="mt-2 text-sm leading-6 text-gray-500">La page demandée n’existe pas ou a été déplacée.</p>
            <RouterLink to="/tableau-de-bord" class="bouton-principal mt-8"><i class="fa-solid fa-arrow-left text-xs"></i> Retour au tableau de bord</RouterLink>
        </div>
    </div>
</template>
