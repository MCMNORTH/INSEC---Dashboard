<script setup lang="ts">
import { collection, query, where } from 'firebase/firestore';
import { computed, reactive, ref, watchEffect } from 'vue';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import ModaleConfirmation from '../../composants/ModaleConfirmation.vue';
import { useDocument, useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Affectation, Enseignant } from '../../types';

const props = defineProps<{ id: string }>();
const { ues, ue } = useReferentiel();
const { donnee: enseignant, chargement } = useDocument<Enseignant>(() => `enseignants/${props.id}`);
const { donnees: affectations } = useRequete<Affectation>(() => query(collection(db, 'affectations'), where('enseignantId', '==', props.id)));
const uesDisponibles = computed(() => {
    const prises = new Set(affectations.value.map((a) => a.ueId));
    return [...ues.value].filter((u) => !prises.has(u.id)).sort((a, b) => a.libelle.localeCompare(b.libelle));
});
const nouvelle = reactive({ ueId: '', nombreEtudiants: 0 });
watchEffect(() => {
    if (!uesDisponibles.value.some((u) => u.id === nouvelle.ueId)) nouvelle.ueId = uesDisponibles.value[0]?.id ?? '';
});
const { envoi, soumettre } = useFormulaire();
const aRetirer = ref<Affectation | null>(null);
const initiales = computed(() => `${enseignant.value?.prenom?.[0] ?? ''}${enseignant.value?.nom?.[0] ?? ''}`.toUpperCase());

async function affecter() {
    const resultat = await soumettre(() => appeler('affecterUe', { enseignantId: props.id, ...nouvelle }));
    if (resultat) notifier(resultat.message ?? 'UE affectée avec succès.');
}

async function retirer() {
    const cible = aRetirer.value;
    if (!cible) return;
    const resultat = await soumettre(() => appeler('retirerAffectation', { id: cible.id }));
    aRetirer.value = null;
    if (resultat) notifier(resultat.message ?? 'Affectation retirée.');
}
</script>

<template>
    <div class="max-w-3xl">
        <RouterLink to="/enseignants" class="text-sm text-gray-500">← Retour à la liste</RouterLink>
        <Chargement :chargement="chargement" :vide="!enseignant" message-vide="Enseignant introuvable.">
            <template v-if="enseignant">
                <div class="carte mt-4 p-6">
                    <div class="mb-6 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-insec font-bold text-white">{{ initiales }}</div>
                            <div>
                                <h1 class="text-lg font-bold text-insec">{{ enseignant.nom }} {{ enseignant.prenom }}</h1>
                                <p class="text-sm text-gray-500">{{ enseignant.specialite }}</p>
                            </div>
                        </div>
                        <RouterLink :to="`/enseignants/${id}/modifier`" class="text-gray-400 hover:text-blue-600" title="Modifier"><i class="fa-solid fa-pen text-lg"></i></RouterLink>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="rounded-lg bg-gray-50 p-4"><p class="text-xs text-gray-500">E-mail</p><p class="font-medium break-all">{{ enseignant.email }}</p></div>
                        <div class="rounded-lg bg-gray-50 p-4"><p class="text-xs text-gray-500">Téléphone</p><p class="font-medium">{{ enseignant.telephone || '—' }}</p></div>
                    </div>
                </div>
                <div class="carte mt-4 p-6">
                    <h2 class="mb-4 font-bold text-insec">UE affectées et étudiants</h2>
                    <table class="tableau mb-4">
                        <thead><tr><th>UE</th><th>Crédits</th><th>Étudiants</th><th class="w-10"></th></tr></thead>
                        <tbody>
                            <tr v-for="a in affectations" :key="a.id">
                                <td>{{ ue(a.ueId)?.code }} — {{ ue(a.ueId)?.libelle }}</td>
                                <td>{{ ue(a.ueId)?.credits }}</td>
                                <td>{{ a.nombreEtudiants }}</td>
                                <td class="text-right"><button class="cursor-pointer text-gray-400 hover:text-red-600" title="Retirer" @click="aRetirer = a"><i class="fa-solid fa-trash"></i></button></td>
                            </tr>
                            <tr v-if="!affectations.length"><td colspan="4" class="text-center text-gray-400">Aucune UE affectée.</td></tr>
                        </tbody>
                    </table>
                    <form v-if="uesDisponibles.length" class="flex flex-wrap items-end gap-3 border-t pt-4" @submit.prevent="affecter">
                        <label class="min-w-[180px] flex-1 text-xs text-gray-500">UE à affecter
                            <select v-model="nouvelle.ueId" class="champ mt-1" required>
                                <option v-for="u in uesDisponibles" :key="u.id" :value="u.id">{{ u.code }} — {{ u.libelle }}</option>
                            </select>
                        </label>
                        <label class="w-32 text-xs text-gray-500">Étudiants <input v-model.number="nouvelle.nombreEtudiants" type="number" min="0" class="champ mt-1" required /></label>
                        <button class="bouton-action" :disabled="envoi">+ Ajouter</button>
                    </form>
                    <p v-else class="border-t pt-4 text-sm text-gray-400">Toutes les UE sont déjà affectées à cet enseignant.</p>
                </div>
            </template>
        </Chargement>
    </div>
    <ModaleConfirmation
        :ouverte="!!aRetirer"
        :envoi="envoi"
        titre="Retirer l’affectation"
        libelle="Retirer"
        :message="`Retirer l’UE ${ue(aRetirer?.ueId)?.libelle ?? ''} de cet enseignant ?`"
        @annuler="aRetirer = null"
        @confirmer="retirer"
    />
</template>
