<script setup lang="ts">
import { computed, watch } from 'vue';
import { useReferentiel } from '../referentiel';

export interface ValeursInscription {
    formationId: string;
    anneeId: string;
    anneeParcours: number | '';
    dateInscription: string;
    noteFinanciere: string;
    numeroIntec: string;
    statut?: string;
    ueIds: string[];
}

defineProps<{ erreurs: Record<string, string>; avecStatut?: boolean }>();
const valeurs = defineModel<ValeursInscription>({ required: true });
const { formationsActives, annees, anneeCourante, ues, formation } = useReferentiel();

const duree = computed(() => formation(valeurs.value.formationId)?.dureeAnnees ?? 3);
const uesProposees = computed(() =>
    ues.value.filter((u) => u.active !== false && u.formationId === valeurs.value.formationId && u.anneeParcours === Number(valeurs.value.anneeParcours)),
);
// Comme dans le formulaire d'origine : changer de diplôme ou d'année décoche les UE devenues incompatibles.
watch(uesProposees, (liste) => {
    const permises = new Set(liste.map((u) => u.id));
    valeurs.value.ueIds = valeurs.value.ueIds.filter((id) => permises.has(id));
});
watch([annees, anneeCourante], () => {
    if (!valeurs.value.anneeId && anneeCourante.value) valeurs.value.anneeId = anneeCourante.value.id;
}, { immediate: true });

const STATUTS = [['active', 'Active'], ['terminée', 'Terminée'], ['suspendue', 'Suspendue'], ['annulée', 'Annulée']];
</script>

<template>
    <div class="grid gap-4 md:grid-cols-2">
        <label class="etiquette">Diplôme
            <select v-model="valeurs.formationId" class="champ mt-1" required>
                <option value="">Sélectionner…</option>
                <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.code }} — {{ f.libelle }}</option>
            </select>
            <span v-if="erreurs.formationId" class="text-xs text-red-600">{{ erreurs.formationId }}</span>
        </label>
        <label class="etiquette">Année académique
            <select v-model="valeurs.anneeId" class="champ mt-1" required>
                <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
            </select>
        </label>
        <label class="etiquette">Année de parcours
            <select v-model.number="valeurs.anneeParcours" class="champ mt-1" required>
                <option value="">Sélectionner…</option>
                <option v-for="i in duree" :key="i" :value="i">Année {{ i }}</option>
            </select>
        </label>
        <label class="etiquette">Date d’inscription <span class="text-gray-400">(facultative)</span>
            <input v-model="valeurs.dateInscription" type="date" class="champ mt-1" />
        </label>
        <label class="etiquette">N° d’inscription INTEC <span class="text-gray-400">(facultatif)</span>
            <input v-model="valeurs.numeroIntec" class="champ mt-1" maxlength="100" />
        </label>
        <label v-if="avecStatut" class="etiquette">Statut de l’inscription
            <select v-model="valeurs.statut" class="champ mt-1">
                <option v-for="[v, l] in STATUTS" :key="v" :value="v">{{ l }}</option>
            </select>
        </label>
    </div>
    <label class="etiquette mt-4 block">Note financière <span class="text-gray-400">(facultative)</span>
        <textarea v-model="valeurs.noteFinanciere" class="champ mt-1 min-h-20" maxlength="2000" />
        <span v-if="erreurs.noteFinanciere" class="text-xs text-red-600">{{ erreurs.noteFinanciere }}</span>
    </label>
    <div class="mt-4">
        <p class="mb-2 text-sm font-medium text-gray-700">UE suivies</p>
        <div class="grid gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-2">
            <label v-for="ue in uesProposees" :key="ue.id" class="flex gap-2 rounded p-2 text-sm hover:bg-gray-50">
                <input v-model="valeurs.ueIds" type="checkbox" :value="ue.id" class="mt-0.5 rounded border-gray-300" />
                <span><strong>{{ ue.code }}</strong> — {{ ue.libelle }} <span class="text-xs text-gray-500">({{ ue.credits }} ECTS)</span></span>
            </label>
            <p v-if="!uesProposees.length" class="text-sm text-gray-500">Choisissez d’abord le diplôme et l’année de parcours.</p>
        </div>
        <p v-if="erreurs.ueIds" class="mt-1 text-xs text-red-600">{{ erreurs.ueIds }}</p>
    </div>
</template>
