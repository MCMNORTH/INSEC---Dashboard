<script setup lang="ts">
import { collection, doc, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appeler, messageErreur } from '../api';
import Chargement from '../composants/Chargement.vue';
import Pagination from '../composants/Pagination.vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { depuis } from '../format';
import { notifier } from '../notifications';
import { session } from '../session';
import type { Alerte } from '../types';

const router = useRouter();
const synchronisation = ref(true);
const page = ref(1);
const { donnees: alertes, chargement, erreur } = useRequete<Alerte>(() =>
    session.uid
        ? query(collection(db, 'utilisateurs', session.uid, 'alertes'), where('active', '==', true), where('archiveeLe', '==', null), orderBy('modifieLe', 'desc'))
        : null,
);
const affichees = computed(() => alertes.value.slice((page.value - 1) * 20, page.value * 20));

onMounted(async () => {
    try {
        await appeler('synchroniserAlertes');
    } catch (e) {
        notifier(messageErreur(e), { type: 'erreur' });
    } finally {
        synchronisation.value = false;
    }
});

const reference = (a: Alerte) => doc(db, 'utilisateurs', session.uid!, 'alertes', a.id);

async function lire(a: Alerte) {
    if (!a.lueLe) await updateDoc(reference(a), { lueLe: serverTimestamp() });
    if (a.lien) await router.push(a.lien);
}

async function archiver(a: Alerte) {
    await updateDoc(reference(a), { archiveeLe: serverTimestamp(), ...(a.lueLe ? {} : { lueLe: serverTimestamp() }) });
    notifier('Alerte archivée.');
}

async function toutLire() {
    const lot = writeBatch(db);
    alertes.value.filter((a) => !a.lueLe).forEach((a) => lot.update(reference(a), { lueLe: serverTimestamp() }));
    await lot.commit();
    notifier('Toutes les alertes ont été marquées comme lues.');
}

const STYLES: Record<string, [string, string]> = {
    danger: ['bg-red-50 text-red-700', 'fa-circle-exclamation'],
    warning: ['bg-amber-50 text-amber-700', 'fa-triangle-exclamation'],
    success: ['bg-emerald-50 text-emerald-700', 'fa-circle-check'],
    info: ['bg-insec-50 text-insec-700', 'fa-circle-info'],
};
</script>

<template>
    <div class="mx-auto max-w-5xl">
        <header class="en-tete-page">
            <div>
                <p class="surtitre">Notifications</p>
                <h1 class="titre-page mt-1.5">Centre d’alertes</h1>
                <p class="sous-titre">Échéances, examens, documents et résultats importants.</p>
            </div>
            <button class="bouton-secondaire" :disabled="!alertes.some((a) => !a.lueLe)" @click="toutLire"><i class="fa-solid fa-check-double text-xs"></i> Tout marquer comme lu</button>
        </header>
        <p v-if="synchronisation" class="mb-3 flex items-center gap-2 text-xs text-gray-400"><i class="fa-solid fa-rotate fa-spin"></i> Actualisation des alertes…</p>
        <Chargement :chargement="chargement" :erreur="erreur">
            <section v-if="alertes.length" class="carte overflow-hidden">
                <ul class="divide-y divide-gray-100">
                    <li
                        v-for="a in affichees"
                        :key="a.id"
                        :class="['relative flex gap-4 px-5 py-4 transition sm:px-6', a.lueLe ? 'hover:bg-gray-50/70' : 'bg-insec-50/40 hover:bg-insec-50/70']"
                    >
                        <span v-if="!a.lueLe" class="absolute top-6 left-2 h-1.5 w-1.5 rounded-full bg-[#e01a2e] shadow-[0_0_6px_rgb(224_26_46/0.6)]" title="Non lue"></span>
                        <span :class="['flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ring-inset', STYLES[a.niveau]?.[0] ?? 'bg-gray-50 text-gray-700']">
                            <i :class="['fa-solid text-sm', STYLES[a.niveau]?.[1] ?? 'fa-bell']"></i>
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <h2 :class="['text-sm', a.lueLe ? 'font-medium text-gray-700' : 'font-semibold text-gray-900']">{{ a.titre }}</h2>
                                <span class="text-xs whitespace-nowrap text-gray-400">{{ depuis(a.modifieLe) }}</span>
                            </div>
                            <p class="mt-1 text-sm leading-6 text-gray-600">{{ a.message }}</p>
                            <div class="mt-2.5 flex flex-wrap items-center gap-2">
                                <button class="bouton-secondaire min-h-8 px-3 py-1 text-xs" @click="lire(a)">{{ a.lien ? 'Consulter' : 'Marquer comme lue' }} <i class="fa-solid fa-arrow-right text-[10px]"></i></button>
                                <button class="bouton-fantome min-h-8 px-3 py-1 text-xs" @click="archiver(a)"><i class="fa-solid fa-box-archive text-[11px]"></i> Archiver</button>
                            </div>
                        </div>
                    </li>
                </ul>
            </section>
            <div v-else-if="!synchronisation" class="carte flex flex-col items-center px-6 py-16 text-center">
                <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><i class="fa-regular fa-bell text-xl"></i></span>
                <p class="mt-4 font-semibold text-gray-900">Aucune alerte active</p>
                <p class="mt-1 text-sm text-gray-500">Tout est à jour pour le moment.</p>
            </div>
            <Pagination v-model="page" :total="alertes.length" :par-page="20" />
        </Chargement>
    </div>
</template>
