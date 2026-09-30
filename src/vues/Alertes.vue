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
    success: ['bg-green-50 text-green-700', 'fa-circle-check'],
    info: ['bg-blue-50 text-blue-700', 'fa-circle-info'],
};
</script>

<template>
    <div class="mx-auto max-w-5xl">
        <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="titre-page">Centre d’alertes</h1>
                <p class="mt-1 text-sm text-gray-500">Échéances, examens, documents et résultats importants.</p>
            </div>
            <button class="bouton-secondaire" :disabled="!alertes.some((a) => !a.lueLe)" @click="toutLire"><i class="fa-solid fa-check-double"></i> Tout marquer comme lu</button>
        </div>
        <p v-if="synchronisation" class="mb-3 text-xs text-gray-400"><i class="fa-solid fa-rotate fa-spin mr-1"></i> Actualisation des alertes…</p>
        <Chargement :chargement="chargement" :erreur="erreur">
            <div class="space-y-3">
                <article
                    v-for="a in affichees"
                    :key="a.id"
                    :class="['flex gap-4 rounded-xl border bg-white p-5', a.lueLe ? 'border-gray-200 opacity-75' : 'border-insec-or']"
                >
                    <div :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-full', STYLES[a.niveau]?.[0] ?? 'bg-gray-50 text-gray-700']">
                        <i :class="['fa-solid', STYLES[a.niveau]?.[1] ?? 'fa-bell']"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex justify-between gap-3">
                            <h2 class="font-semibold text-insec">{{ a.titre }}</h2>
                            <span class="text-xs whitespace-nowrap text-gray-400">{{ depuis(a.modifieLe) }}</span>
                        </div>
                        <p class="mt-1 text-sm text-gray-600">{{ a.message }}</p>
                        <div class="mt-3 flex gap-4">
                            <button class="cursor-pointer text-sm font-semibold text-insec" @click="lire(a)">{{ a.lien ? 'Consulter' : 'Marquer comme lue' }} <i class="fa-solid fa-arrow-right ml-1"></i></button>
                            <button class="cursor-pointer text-sm text-gray-400 hover:text-gray-700" @click="archiver(a)">Archiver</button>
                        </div>
                    </div>
                </article>
                <div v-if="!alertes.length && !synchronisation" class="rounded-xl border border-gray-200 bg-white p-12 text-center">
                    <i class="fa-regular fa-bell text-4xl text-gray-300"></i>
                    <p class="mt-4 font-semibold">Aucune alerte active</p>
                    <p class="mt-1 text-sm text-gray-500">Tout est à jour pour le moment.</p>
                </div>
            </div>
            <Pagination v-model="page" :total="alertes.length" :par-page="20" />
        </Chargement>
    </div>
</template>
