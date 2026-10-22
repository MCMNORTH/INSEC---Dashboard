<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// Menu déroulant accessible : ouverture au clic, fermeture au clic extérieur, avec Échap ou après navigation.
withDefaults(defineProps<{ alignement?: 'gauche' | 'droite'; largeur?: string; libelle: string; classeDeclencheur?: string }>(), {
    alignement: 'droite',
    largeur: 'w-64',
    classeDeclencheur: '',
});

const ouvert = ref(false);
const racine = ref<HTMLElement | null>(null);
const panneau = ref<HTMLElement | null>(null);
const route = useRoute();
watch(() => route.fullPath, () => (ouvert.value = false));

function clicExterieur(evenement: MouseEvent) {
    if (racine.value && !racine.value.contains(evenement.target as Node)) ouvert.value = false;
}
function clavier(evenement: KeyboardEvent) {
    if (!ouvert.value) return;
    const items = Array.from(panneau.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (evenement.key === 'Escape') {
        ouvert.value = false;
        racine.value?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    } else if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
        evenement.preventDefault();
        const pas = evenement.key === 'ArrowDown' ? 1 : -1;
        items[(index + pas + items.length) % items.length]?.focus();
    }
}
watch(ouvert, async (valeur) => {
    if (valeur) {
        document.addEventListener('mousedown', clicExterieur);
        document.addEventListener('keydown', clavier);
        await nextTick();
        panneau.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    } else {
        document.removeEventListener('mousedown', clicExterieur);
        document.removeEventListener('keydown', clavier);
    }
});
onBeforeUnmount(() => {
    document.removeEventListener('mousedown', clicExterieur);
    document.removeEventListener('keydown', clavier);
});
const fermer = () => (ouvert.value = false);
</script>

<template>
    <div ref="racine" class="relative">
        <button type="button" aria-haspopup="menu" :aria-expanded="ouvert" :aria-label="libelle" :class="['cursor-pointer', classeDeclencheur]" @click="ouvert = !ouvert">
            <slot name="declencheur" :ouvert="ouvert" />
        </button>
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
        >
            <div
                v-if="ouvert"
                ref="panneau"
                role="menu"
                :class="[
                    'absolute top-full z-50 mt-2 origin-top overflow-hidden rounded-2xl border border-gray-200/80 bg-surface/95 p-1.5 shadow-flottant backdrop-blur-xl',
                    alignement === 'droite' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
                    largeur,
                ]"
                @click="fermer"
            >
                <slot :fermer="fermer" />
            </div>
        </Transition>
    </div>
</template>
