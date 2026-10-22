<script setup lang="ts">
import { basculerTheme, modeSombre } from '../theme';
</script>

<template>
    <button
        type="button"
        class="bouton-icone relative h-10 w-10 overflow-hidden"
        :aria-label="modeSombre ? 'Passer en mode clair' : 'Passer en mode sombre'"
        :title="modeSombre ? 'Mode clair' : 'Mode sombre'"
        @click="basculerTheme"
    >
        <Transition
            mode="out-in"
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 rotate-90 scale-50"
            leave-active-class="transition duration-150 ease-in"
            leave-to-class="opacity-0 -rotate-90 scale-50"
        >
            <i v-if="modeSombre" key="soleil" class="fa-regular fa-sun text-[17px]"></i>
            <i v-else key="lune" class="fa-regular fa-moon text-[16px]"></i>
        </Transition>
    </button>
</template>
