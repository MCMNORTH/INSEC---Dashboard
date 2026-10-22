<script setup lang="ts">
// Logo INSEC dessiné en SVG : les deux ailes (bleu et rouge) et le nom en capitales à empattements.
// L'aile bleue et le nom passent en blanc en mode sombre ; « clair » les force en blanc (fond coloré).
withDefaults(defineProps<{ clair?: boolean; compacte?: boolean }>(), { clair: false, compacte: false });
</script>

<template>
    <span :class="['inline-flex flex-col items-center leading-none', clair ? 'text-white' : 'text-[#0b2157] dark:text-white']" aria-label="INSEC" role="img">
        <svg viewBox="0 0 100 34" :class="compacte ? 'h-6 w-auto' : 'h-7 w-auto'" aria-hidden="true">
            <path d="M3 9.5C19 2.5 38 4.5 49 33 41 13 22 6.5 3 9.5Z" fill="currentColor" />
            <path d="M97 9.5C81 2.5 62 4.5 51 33 59 13 78 6.5 97 9.5Z" fill="#e01a2e" />
        </svg>
        <span v-if="!compacte" class="mt-1.5 pl-[0.42em] font-marque text-[1.35rem] font-semibold tracking-[0.42em]">INSEC</span>
    </span>
</template>
