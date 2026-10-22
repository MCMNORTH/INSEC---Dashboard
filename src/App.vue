<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BarreLaterale from './composants/BarreLaterale.vue';
import BarreSuperieure from './composants/BarreSuperieure.vue';
import MarqueInsec from './composants/MarqueInsec.vue';
import MessageFlash from './composants/MessageFlash.vue';
import PaletteCommandes from './composants/PaletteCommandes.vue';
import { aRole, session } from './session';

const route = useRoute();
const miseEnPage = computed(() => {
    if (route.meta.publique || !session.uid) return 'publique';
    return aRole('admin', 'super_admin', 'finance') ? 'administration' : 'portail';
});

const lire = (cle: string) => {
    try {
        return localStorage.getItem(cle);
    } catch {
        return null;
    }
};
const menuReduit = ref(lire('insec.menuReduit') === '1');
watch(menuReduit, (valeur) => {
    try {
        localStorage.setItem('insec.menuReduit', valeur ? '1' : '0');
    } catch {
        // Préférence simplement non mémorisée.
    }
});
const menuMobile = ref(false);
const recherche = ref(false);
</script>

<template>
    <div v-if="!session.pret" class="flex min-h-screen flex-col items-center justify-center gap-6">
        <MarqueInsec />
        <span class="h-1 w-32 overflow-hidden rounded-full bg-gray-200">
            <span class="block h-full w-1/3 animate-[chargement_1.1s_ease-in-out_infinite] rounded-full bg-insec-700"></span>
        </span>
    </div>
    <RouterView v-else-if="miseEnPage === 'publique'" />
    <div v-else-if="miseEnPage === 'administration'" class="min-h-screen lg:flex">
        <BarreLaterale v-model:reduite="menuReduit" v-model:ouverte-mobile="menuMobile" />
        <div class="flex min-w-0 flex-1 flex-col">
            <BarreSuperieure @menu="menuMobile = true" @recherche="recherche = true" />
            <main class="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                <RouterView v-slot="{ Component }">
                    <div :key="route.path" class="animate-apparition">
                        <component :is="Component" />
                    </div>
                </RouterView>
            </main>
        </div>
        <PaletteCommandes v-model="recherche" />
    </div>
    <!-- Comptes hors équipe INSEC (anciens rôles étudiant/enseignant) : seule la page « Accès refusé » s'affiche. -->
    <div v-else class="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <RouterView :key="route.path" />
    </div>
    <MessageFlash />
</template>

<style>
@keyframes chargement {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
}
</style>
