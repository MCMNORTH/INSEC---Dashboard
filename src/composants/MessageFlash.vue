<script setup lang="ts">
import { flash } from '../notifications';
</script>

<template>
    <div
        v-if="flash.texte"
        role="status"
        :class="['mb-4 flex items-start justify-between gap-3 rounded-lg border p-3 text-sm', flash.type === 'succes' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800']"
    >
        <span>{{ flash.texte }}</span>
        <button class="cursor-pointer opacity-60 hover:opacity-100" aria-label="Fermer" @click="flash.texte = ''"><i class="fa-solid fa-xmark"></i></button>
    </div>
</template>
