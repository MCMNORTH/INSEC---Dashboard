<script setup lang="ts">
const props = defineProps<{ statut: string }>();

type Ton = 'succes' | 'attention' | 'danger' | 'info' | 'neutre';
const TONS: Record<string, Ton> = {
    Actif: 'succes',
    Suspendu: 'attention',
    Diplômé: 'info',
    Abandon: 'danger',
    Soldé: 'succes',
    Partiel: 'attention',
    Impayé: 'danger',
    'À chiffrer': 'attention',
    Annulée: 'neutre',
    'Pris en charge BUMEX': 'info',
    Validée: 'succes',
    'En attente': 'attention',
    Rejetée: 'danger',
    Envoyé: 'succes',
    Échec: 'danger',
    Validé: 'succes',
    Rejeté: 'danger',
    'À vérifier': 'attention',
    Admissible: 'succes',
    Inscrite: 'info',
    'En étude': 'attention',
};
const STYLES: Record<Ton, { pastille: string; point: string }> = {
    succes: { pastille: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', point: 'bg-emerald-500' },
    attention: { pastille: 'bg-amber-50 text-amber-800 ring-amber-600/20', point: 'bg-amber-500' },
    danger: { pastille: 'bg-red-50 text-red-700 ring-red-600/15', point: 'bg-red-500' },
    info: { pastille: 'bg-insec-50 text-insec-700 ring-insec-600/15', point: 'bg-insec-500' },
    neutre: { pastille: 'bg-gray-50 text-gray-600 ring-gray-500/15', point: 'bg-gray-400' },
};
</script>

<template>
    <span :class="['pastille', STYLES[TONS[props.statut] ?? 'neutre'].pastille]">
        <span :class="['h-1.5 w-1.5 rounded-full', STYLES[TONS[props.statut] ?? 'neutre'].point]"></span>
        {{ props.statut }}
    </span>
</template>
