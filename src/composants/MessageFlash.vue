<script setup lang="ts">
import { watch } from 'vue';
import { flash } from '../notifications';

// Les confirmations disparaissent seules ; les erreurs restent jusqu'à ce qu'on les ferme.
let minuterie: ReturnType<typeof setTimeout> | undefined;
watch(() => [flash.texte, flash.type], () => {
    clearTimeout(minuterie);
    if (flash.texte && flash.type === 'succes') minuterie = setTimeout(() => (flash.texte = ''), 6000);
});
</script>

<template>
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 sm:inset-x-auto sm:right-0 sm:justify-end sm:p-6" aria-live="polite">
        <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-3 scale-95"
            leave-active-class="transition duration-200 ease-in"
            leave-to-class="opacity-0 translate-y-2"
        >
            <div
                v-if="flash.texte"
                :key="flash.texte"
                :role="flash.type === 'erreur' ? 'alert' : 'status'"
                class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-gray-200/80 bg-surface/95 p-4 shadow-flottant backdrop-blur-xl"
            >
                <span
                    :class="[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        flash.type === 'succes' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-red-50 text-red-600 ring-1 ring-red-100',
                    ]"
                >
                    <i :class="['fa-solid text-sm', flash.type === 'succes' ? 'fa-check' : 'fa-exclamation']"></i>
                </span>
                <p class="min-w-0 flex-1 pt-1.5 text-sm leading-5 text-gray-800">{{ flash.texte }}</p>
                <button type="button" class="bouton-icone -mt-0.5 -mr-1 h-8 w-8" aria-label="Fermer" @click="flash.texte = ''">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </Transition>
    </div>
</template>
