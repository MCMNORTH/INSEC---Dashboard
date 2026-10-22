<script setup lang="ts">
defineProps<{ chargement: boolean; erreur?: string | null; vide?: boolean; messageVide?: string }>();
</script>

<template>
    <div v-if="chargement" class="carte overflow-hidden" aria-busy="true" aria-label="Chargement">
        <div v-for="ligne in 5" :key="ligne" class="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-0">
            <span class="squelette h-9 w-9 rounded-full"></span>
            <span class="flex-1 space-y-2">
                <span class="squelette block h-3 rounded-full" :style="{ width: `${70 - ligne * 8}%` }"></span>
                <span class="squelette block h-2.5 w-1/4 rounded-full"></span>
            </span>
            <span class="squelette hidden h-6 w-20 rounded-full sm:block"></span>
        </div>
    </div>
    <div v-else-if="erreur" role="alert" class="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800">
        <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>
        <span>{{ erreur }}</span>
    </div>
    <div v-else-if="vide" class="carte flex flex-col items-center px-6 py-14 text-center">
        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><i class="fa-regular fa-folder-open text-lg"></i></span>
        <p class="mt-3 text-sm text-gray-500">{{ messageVide ?? 'Aucun élément.' }}</p>
    </div>
    <slot v-else />
</template>

<style scoped>
.squelette {
    background: linear-gradient(90deg, var(--color-gray-100) 0%, var(--color-gray-50) 50%, var(--color-gray-100) 100%);
    background-size: 200% 100%;
    animation: reflet 1.4s ease-in-out infinite;
}
@keyframes reflet {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
}
</style>
