<script setup lang="ts">
defineProps<{ ouverte: boolean; titre?: string; message: string; libelle?: string; envoi?: boolean }>();
defineEmits<{ confirmer: []; annuler: [] }>();
</script>

<template>
    <Teleport to="body">
        <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
            <div v-if="ouverte" class="fixed inset-0 z-[60] flex items-center justify-center bg-insec-950/45 p-4 backdrop-blur-sm" @click.self="$emit('annuler')" @keydown.esc="$emit('annuler')">
                <div role="alertdialog" aria-modal="true" :aria-label="titre ?? 'Confirmer la suppression'" class="w-full max-w-md animate-surgir rounded-3xl bg-white p-6 shadow-[0_24px_64px_-12px_rgb(18_23_53/0.35)] sm:p-7">
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-8 ring-red-50/50">
                        <i class="fa-solid fa-triangle-exclamation text-lg"></i>
                    </div>
                    <h3 class="mt-5 text-lg font-bold text-gray-900">{{ titre ?? 'Confirmer la suppression' }}</h3>
                    <p class="mt-2 text-sm leading-6 text-gray-600">{{ message }}</p>
                    <div class="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                        <button type="button" class="bouton-secondaire" @click="$emit('annuler')">Annuler</button>
                        <button type="button" class="bouton-danger" :disabled="envoi" @click="$emit('confirmer')">
                            <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>{{ libelle ?? 'Supprimer' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
