<script setup lang="ts">
defineProps<{ chargement: boolean; erreur?: string | null; vide?: boolean; messageVide?: string }>();
</script>

<template>
    <div v-if="chargement" class="p-8 text-center text-sm text-gray-400"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Chargement…</div>
    <div v-else-if="erreur" class="rounded-lg bg-red-50 p-4 text-sm text-red-700">{{ erreur }}</div>
    <div v-else-if="vide" class="rounded-xl bg-white p-8 text-center text-gray-400">{{ messageVide ?? 'Aucun élément.' }}</div>
    <slot v-else />
</template>
