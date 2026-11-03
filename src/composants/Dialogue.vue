<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { dialogue, fermerDialogue } from '../dialogue';

const boutonConfirmer = ref<HTMLButtonElement | null>(null);
const champ = ref<HTMLTextAreaElement | null>(null);
let focusPrecedent: HTMLElement | null = null;

const avecMotif = computed(() => Boolean(dialogue.options.champ));
const peutConfirmer = computed(() => !avecMotif.value || dialogue.saisie.trim().length > 0);
const ton = computed(() => dialogue.options.ton ?? 'action');
const icone = computed(() => ({ action: 'fa-circle-check', danger: 'fa-triangle-exclamation', envoi: 'fa-paper-plane' })[ton.value]);
const couleurIcone = computed(() => ({
    action: 'bg-insec-50 text-insec-700 ring-insec-50/60',
    danger: 'bg-red-50 text-red-600 ring-red-50/60',
    envoi: 'bg-sky-50 text-sky-700 ring-sky-50/60',
})[ton.value]);

function valider() {
    if (peutConfirmer.value) fermerDialogue(dialogue.saisie);
}

// Échap et Entrée sont traités avant les autres écouteurs (ex. fermeture du dossier financier par Échap).
function touche(e: KeyboardEvent) {
    if (!dialogue.ouvert) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        fermerDialogue(null);
    } else if (e.key === 'Enter' && !e.shiftKey) {
        // Entrée confirme (Maj+Entrée ajoute une ligne au motif) ; sur « Annuler », le bouton garde son action.
        if (e.target instanceof HTMLButtonElement && e.target !== boutonConfirmer.value) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        valider();
    }
}
onMounted(() => window.addEventListener('keydown', touche, true));
onBeforeUnmount(() => window.removeEventListener('keydown', touche, true));

watch(() => dialogue.ouvert, async (ouvert) => {
    if (ouvert) {
        focusPrecedent = document.activeElement as HTMLElement | null;
        await nextTick();
        (avecMotif.value ? champ.value : boutonConfirmer.value)?.focus();
    } else {
        focusPrecedent?.focus?.();
        focusPrecedent = null;
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
            <div v-if="dialogue.ouvert" class="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" @mousedown.self="fermerDialogue(null)">
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="dialogue-titre"
                    :aria-describedby="dialogue.options.message ? 'dialogue-message' : undefined"
                    class="w-full max-w-md animate-surgir rounded-3xl bg-surface p-6 shadow-[0_24px_64px_-12px_rgb(18_23_53/0.35)] sm:p-7"
                >
                    <div class="flex items-start gap-4">
                        <span :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-8', couleurIcone]">
                            <i :class="['fa-solid text-base', icone]"></i>
                        </span>
                        <div class="min-w-0 flex-1 pt-0.5">
                            <h3 id="dialogue-titre" class="text-lg leading-6 font-bold text-gray-900">{{ dialogue.options.titre }}</h3>
                            <p v-if="dialogue.options.message" id="dialogue-message" class="mt-1.5 text-sm leading-6 whitespace-pre-line text-gray-600">{{ dialogue.options.message }}</p>
                        </div>
                    </div>

                    <dl v-if="dialogue.options.details" class="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4">
                        <div v-for="(valeur, cle) in dialogue.options.details" :key="cle" class="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                            <dt class="text-gray-500">{{ cle }}</dt>
                            <dd class="min-w-0 truncate text-right font-semibold text-gray-900" :title="valeur">{{ valeur }}</dd>
                        </div>
                    </dl>

                    <label v-if="avecMotif" class="mt-5 block">
                        <span class="etiquette">{{ dialogue.options.champ }} <span class="text-red-600">*</span></span>
                        <textarea
                            ref="champ"
                            v-model="dialogue.saisie"
                            rows="2"
                            maxlength="500"
                            class="champ mt-1.5 resize-none"
                            :placeholder="dialogue.options.indication"
                        ></textarea>
                    </label>

                    <div class="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                        <button type="button" class="bouton-secondaire" @click="fermerDialogue(null)">Annuler</button>
                        <button
                            ref="boutonConfirmer"
                            type="button"
                            :class="ton === 'danger' ? 'bouton-danger' : 'bouton-action'"
                            :disabled="!peutConfirmer"
                            @click="valider"
                        >
                            {{ dialogue.options.libelle ?? 'Confirmer' }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
