<script setup lang="ts">
import { accueil, session } from '../session';
</script>

<template>
    <div class="mx-auto max-w-lg rounded-2xl bg-white p-10 text-center shadow">
        <i class="fa-solid fa-lock text-4xl text-gray-300"></i>
        <h1 class="mt-4 text-2xl font-bold text-insec">Accès refusé</h1>
        <p class="mt-2 text-gray-500">Votre compte ne dispose pas des droits nécessaires pour consulter cette page.</p>
        <RouterLink v-if="session.role" :to="accueil()" class="bouton-principal mt-6">Retour à mon espace</RouterLink>
    </div>
</template>
