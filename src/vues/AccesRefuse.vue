<script setup lang="ts">
import { accueil, session } from '../session';
</script>

<template>
    <div class="flex min-h-[60vh] items-center justify-center">
        <div class="carte w-full max-w-md animate-apparition p-10 text-center">
            <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-insec-50 text-insec-600 ring-8 ring-insec-50/50">
                <i class="fa-solid fa-lock text-xl"></i>
            </span>
            <h1 class="mt-6 font-titre text-2xl font-bold tracking-tight text-gray-900">Accès refusé</h1>
            <p class="mt-2 text-sm leading-6 text-gray-500">Votre compte ne dispose pas des droits nécessaires pour consulter cette page.</p>
            <RouterLink v-if="session.role" :to="accueil()" class="bouton-principal mt-7"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à mon espace</RouterLink>
        </div>
    </div>
</template>
