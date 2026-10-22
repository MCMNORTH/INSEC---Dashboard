<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ total: number; parPage: number }>();
const page = defineModel<number>({ required: true });
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.parPage)));
</script>

<template>
    <nav v-if="pages > 1" class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500" aria-label="Pagination">
        <span><strong class="font-semibold text-gray-800">{{ (page - 1) * parPage + 1 }}–{{ Math.min(page * parPage, total) }}</strong> sur {{ total }}</span>
        <div class="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-xs">
            <button type="button" class="bouton-icone h-8 w-8" :disabled="page <= 1" aria-label="Page précédente" @click="page--"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <span class="px-2 text-[13px] font-medium text-gray-700 tabular-nums">{{ page }} / {{ pages }}</span>
            <button type="button" class="bouton-icone h-8 w-8" :disabled="page >= pages" aria-label="Page suivante" @click="page++"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        </div>
    </nav>
</template>
