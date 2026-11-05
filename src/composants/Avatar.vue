<script setup lang="ts">
import { initiales } from '../navigation';

// Photo de profil si elle existe, sinon les initiales sur fond aux couleurs de l'INSEC.
withDefaults(defineProps<{ nom: string; photo?: string | null; classe?: string }>(), {
    photo: null,
    classe: 'h-8 w-8 text-[11px]',
});
</script>

<template>
    <img v-if="photo" :src="photo" alt="" :class="['shrink-0 rounded-full object-cover', classe]" />
    <span v-else :class="['flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-insec-600 to-insec-700 font-bold text-white', classe]">
        {{ initiales(nom) }}
    </span>
</template>
