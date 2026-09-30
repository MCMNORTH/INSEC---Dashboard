<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ total: number; parPage: number }>();
const page = defineModel<number>({ required: true });
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.parPage)));
</script>

<template>
    <nav v-if="pages > 1" class="mt-4 flex items-center justify-between text-sm text-gray-600" aria-label="Pagination">
        <span>{{ (page - 1) * parPage + 1 }}–{{ Math.min(page * parPage, total) }} sur {{ total }}</span>
        <div class="flex gap-2">
            <button class="bouton-secondaire px-3 py-1" :disabled="page <= 1" @click="page--">‹ Précédent</button>
            <span class="px-2 py-1">Page {{ page }} / {{ pages }}</span>
            <button class="bouton-secondaire px-3 py-1" :disabled="page >= pages" @click="page++">Suivant ›</button>
        </div>
    </nav>
</template>
