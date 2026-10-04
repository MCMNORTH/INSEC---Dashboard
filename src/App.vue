<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import BarreLaterale from './composants/BarreLaterale.vue';
import EnTetePortail from './composants/EnTetePortail.vue';
import MessageFlash from './composants/MessageFlash.vue';
import { aRole, session } from './session';

const route = useRoute();
const miseEnPage = computed(() => {
    if (route.meta.publique || !session.uid) return 'publique';
    return aRole('admin', 'super_admin', 'finance') ? 'administration' : 'portail';
});
</script>

<template>
    <div v-if="!session.pret" class="flex min-h-screen items-center justify-center text-gray-400">
        <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Chargement…
    </div>
    <RouterView v-else-if="miseEnPage === 'publique'" />
    <div v-else-if="miseEnPage === 'administration'" class="min-h-screen bg-gray-100 lg:flex lg:h-screen lg:overflow-hidden">
        <BarreLaterale />
        <main class="min-w-0 flex-1 p-4 sm:p-6 lg:h-screen lg:overflow-y-auto lg:p-8">
            <MessageFlash />
            <RouterView :key="route.path" />
        </main>
    </div>
    <div v-else class="min-h-screen bg-gray-100">
        <EnTetePortail />
        <main class="mx-auto max-w-6xl p-4 sm:p-6">
            <MessageFlash />
            <RouterView :key="route.path" />
        </main>
    </div>
</template>
