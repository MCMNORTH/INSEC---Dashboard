<script setup lang="ts">
defineProps<{ ouverte: boolean; titre?: string; message: string; libelle?: string; envoi?: boolean }>();
defineEmits<{ confirmer: []; annuler: [] }>();
</script>

<template>
    <div v-if="ouverte" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" @click.self="$emit('annuler')">
        <div role="dialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div class="mb-3 flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h3 class="text-lg font-bold text-red-600">{{ titre ?? 'Confirmer la suppression' }}</h3>
            </div>
            <p class="mb-6 text-sm text-gray-600">{{ message }}</p>
            <div class="flex justify-end gap-3">
                <button class="bouton-secondaire" @click="$emit('annuler')">Annuler</button>
                <button class="bouton-danger" :disabled="envoi" @click="$emit('confirmer')">{{ libelle ?? 'Supprimer' }}</button>
            </div>
        </div>
    </div>
</template>
