<script setup lang="ts">
import { computed, watch } from 'vue';
import { useReferentiel } from '../referentiel';

export interface ValeursInscription {
    formationId: string;
    anneeId: string;
    anneeParcours: number | '';
    dateInscription: string | null;
    numeroIntec: string;
    financeur?: 'etudiant' | 'bumex';
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
    <div class="grid gap-x-5 gap-y-4 md:grid-cols-2">
        <label class="etiquette">Diplôme
            <select v-model="valeurs.formationId" class="champ mt-1.5" required>
                <option value="">Sélectionner…</option>
                <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.code }} — {{ f.libelle }}</option>
            </select>
            <span v-if="erreurs.formationId" class="mt-1 block text-xs text-red-600">{{ erreurs.formationId }}</span>
        </label>
        <label class="etiquette">Année scolaire
            <select v-model="valeurs.anneeId" class="champ mt-1.5" required>
                <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
            </select>
        </label>
        <label class="etiquette">Année de parcours
            <select v-model.number="valeurs.anneeParcours" class="champ mt-1.5" required>
                <option value="">Sélectionner…</option>
                <option v-for="i in duree" :key="i" :value="i">Année {{ i }}</option>
            </select>
        </label>
        <label class="etiquette">Date d’inscription <span class="font-normal text-gray-400">(facultative)</span>
            <input v-model="valeurs.dateInscription" type="date" class="champ mt-1.5" />
        </label>
        <label class="etiquette">N° d’inscription INTEC <span class="font-normal text-gray-400">(facultatif)</span>
            <input v-model="valeurs.numeroIntec" class="champ mt-1.5" maxlength="100" />
        </label>
        <label class="etiquette">Prise en charge financière
            <select v-model="valeurs.financeur" class="champ mt-1.5">
                <option value="etudiant">À la charge de l’étudiant</option>
                <option value="bumex">Pris en charge par BUMEX</option>
            </select>
        </label>
        <label v-if="avecStatut" class="etiquette">Statut de l’inscription
            <select v-model="valeurs.statut" class="champ mt-1.5">
                <option v-for="[v, l] in STATUTS" :key="v" :value="v">{{ l }}</option>
            </select>
        </label>
    </div>
    <div class="mt-6">
        <div class="mb-2.5 flex items-center justify-between gap-3">
            <p class="text-[13px] font-medium text-gray-700">UE suivies</p>
            <span v-if="uesProposees.length" class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ valeurs.ueIds.length }} / {{ uesProposees.length }} sélectionnée(s)</span>
        </div>
        <div v-if="uesProposees.length" class="grid gap-2.5 md:grid-cols-2">
            <label
                v-for="ue in uesProposees"
                :key="ue.id"
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-xs transition hover:border-gray-300 has-[:checked]:border-insec-400 has-[:checked]:bg-insec-50/60 has-[:checked]:ring-1 has-[:checked]:ring-insec-400/40"
            >
                <input v-model="valeurs.ueIds" type="checkbox" :value="ue.id" class="mt-0.5" />
                <span class="min-w-0">
                    <strong class="font-semibold text-gray-900">{{ ue.code }}</strong>
                    <span class="text-gray-700"> — {{ ue.libelle }}</span>
                    <span class="mt-0.5 block text-xs text-gray-500">{{ ue.credits }} ECTS</span>
                </span>
            </label>
        </div>
        <div v-else class="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 text-sm text-gray-500">
            <i class="fa-solid fa-circle-info text-gray-400"></i>
            Choisissez d’abord le diplôme et l’année de parcours.
        </div>
        <p v-if="erreurs.ueIds" class="mt-1 block text-xs text-red-600">{{ erreurs.ueIds }}</p>
    </div>
</template>
