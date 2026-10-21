<script setup lang="ts">
const props = defineProps<{ statut: string }>();

const STYLES: Record<string, string> = {
    Actif: 'bg-green-100 text-green-700',
    Suspendu: 'bg-amber-100 text-amber-700',
    Diplômé: 'bg-blue-100 text-blue-700',
    Abandon: 'bg-red-100 text-red-700',
    Soldé: 'bg-green-100 text-green-700',
    Partiel: 'bg-amber-100 text-amber-700',
    Impayé: 'bg-red-100 text-red-700',
    Validée: 'bg-green-100 text-green-700',
    'En attente': 'bg-amber-100 text-amber-700',
    Rejetée: 'bg-red-100 text-red-700',
    Envoyé: 'bg-green-100 text-green-700',
    Échec: 'bg-red-100 text-red-700',
    Validé: 'bg-green-100 text-green-700',
    Rejeté: 'bg-red-100 text-red-700',
    'À vérifier': 'bg-amber-100 text-amber-700',
    Admissible: 'bg-green-100 text-green-700',
    Inscrite: 'bg-blue-100 text-blue-700',
    'En étude': 'bg-amber-100 text-amber-700',
};
</script>

<template>
    <span :class="['inline-block rounded-full px-3 py-1 text-xs font-medium', STYLES[props.statut] ?? 'bg-gray-100 text-gray-700']">{{ props.statut }}</span>
</template>
