<script setup lang="ts">
import { computed, watch } from 'vue';
import { diplomeTarife, formaterMontant, montantDuSelonTarif, TARIFS_UE, TARIFS_VALIDATION, VALIDATIONS_ACQUIS, type ValidationAcquis } from '@shared/domaine';
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
    validationAcquis?: ValidationAcquis;
    ueDispenseesIds?: string[];
}

defineProps<{ erreurs: Record<string, string>; avecStatut?: boolean }>();
const valeurs = defineModel<ValeursInscription>({ required: true });
const { formationsActives, annees, anneeCourante, ues, formation } = useReferentiel();

const duree = computed(() => formation(valeurs.value.formationId)?.dureeAnnees ?? 3);
// Toutes les UE du diplôme sont proposées, groupées par année : un étudiant peut suivre des UE
// de plusieurs années la même année scolaire (choix permis par l'INTEC).
const uesProposees = computed(() =>
    ues.value
        .filter((u) => u.active !== false && u.formationId === valeurs.value.formationId)
        .sort((a, b) => (a.anneeParcours ?? 0) - (b.anneeParcours ?? 0) || String(a.code).localeCompare(String(b.code))),
);
const groupesUe = computed(() => {
    const groupes = new Map<number, typeof uesProposees.value>();
    for (const ue of uesProposees.value) groupes.set(ue.anneeParcours ?? 0, [...(groupes.get(ue.anneeParcours ?? 0) ?? []), ue]);
    return [...groupes.entries()];
});
// Changer de diplôme décoche les UE devenues incompatibles.
watch(uesProposees, (liste) => {
    const permises = new Set(liste.map((u) => u.id));
    valeurs.value.ueIds = valeurs.value.ueIds.filter((id) => permises.has(id));
    valeurs.value.ueDispenseesIds = (valeurs.value.ueDispenseesIds ?? []).filter((id) => permises.has(id));
});

const codeDiplome = computed(() => formation(valeurs.value.formationId)?.code ?? valeurs.value.formationId);
const estCertificat = computed(() => diplomeTarife(codeDiplome.value) === 'CS');
const avecVes = computed(() => (valeurs.value.validationAcquis ?? 'aucune').includes('VES'));
// Sans VES, aucune UE ne peut être dispensée.
watch(avecVes, (oui) => {
    if (!oui) valeurs.value.ueDispenseesIds = [];
});
// Une UE dispensée par VES ne peut pas être suivie la même année (non-cumul) : la cocher la retire des UE suivies.
watch(() => [...(valeurs.value.ueDispenseesIds ?? [])], (dispensees) => {
    valeurs.value.ueIds = valeurs.value.ueIds.filter((id) => !dispensees.includes(id));
});
const estDispensee = (id: string) => (valeurs.value.ueDispenseesIds ?? []).includes(id);
// Montant au tarif, pour information : le serveur refait le calcul à l'enregistrement.
const tarif = computed(() => montantDuSelonTarif(codeDiplome.value, valeurs.value.ueIds.length, valeurs.value.validationAcquis));
const prixUnitaire = computed(() => {
    const d = diplomeTarife(codeDiplome.value);
    return d ? TARIFS_UE[d].mru : 0;
});
const fraisValidation = computed(() => TARIFS_VALIDATION[valeurs.value.validationAcquis ?? 'aucune'].mru);
const LIBELLES_VALIDATION: Record<ValidationAcquis, string> = {
    aucune: 'Aucune',
    VES: `VES — ${formaterMontant(TARIFS_VALIDATION.VES.mru)} MRU`,
    VAPP: `VAPP — ${formaterMontant(TARIFS_VALIDATION.VAPP.mru)} MRU`,
    'VAPP+VES': `VAPP + VES — ${formaterMontant(TARIFS_VALIDATION['VAPP+VES'].mru)} MRU`,
};
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
        <label class="etiquette">Validation des acquis <span class="font-normal text-gray-400">(frais d’instruction INTEC)</span>
            <select v-model="valeurs.validationAcquis" class="champ mt-1.5">
                <option v-for="v in VALIDATIONS_ACQUIS" :key="v" :value="v">{{ LIBELLES_VALIDATION[v] }}</option>
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
            <p class="text-[13px] font-medium text-gray-700">{{ estCertificat ? 'Certificats suivis' : 'UE suivies' }}</p>
            <span v-if="uesProposees.length" class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ valeurs.ueIds.length }} / {{ uesProposees.length }} sélectionnée(s)</span>
        </div>
        <div v-if="uesProposees.length" class="space-y-4">
          <div v-for="[anneeUe, liste] in groupesUe" :key="anneeUe">
            <p class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">UE de l’année {{ anneeUe }}</p>
            <div class="grid gap-2.5 md:grid-cols-2">
            <label
                v-for="ue in liste"
                :key="ue.id"
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-surface p-3 text-sm shadow-xs transition hover:border-gray-300 has-[:checked]:border-insec-400 has-[:checked]:bg-insec-50/60 has-[:checked]:ring-1 has-[:checked]:ring-insec-400/40"
            >
                <input v-model="valeurs.ueIds" type="checkbox" :value="ue.id" class="mt-0.5" :disabled="estDispensee(ue.id)" />
                <span class="min-w-0">
                    <strong class="font-semibold text-gray-900">{{ ue.code }}</strong>
                    <span class="text-gray-700"> — {{ ue.libelle }}</span>
                    <span v-if="estDispensee(ue.id)" class="mt-0.5 block text-xs font-medium text-emerald-700">Dispensée par VES</span>
                    <span v-else-if="ue.credits" class="mt-0.5 block text-xs text-gray-500">{{ ue.credits }} ECTS</span>
                </span>
            </label>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 text-sm text-gray-500">
            <i class="fa-solid fa-circle-info text-gray-400"></i>
            Choisissez d’abord le diplôme.
        </div>
        <p v-if="erreurs.ueIds" class="mt-1 block text-xs text-red-600">{{ erreurs.ueIds }}</p>
    </div>
    <div v-if="avecVes && uesProposees.length" class="mt-6">
        <p class="mb-1 text-[13px] font-medium text-gray-700">UE dispensées par la VES</p>
        <p class="mb-2.5 text-xs text-gray-500">À cocher selon la notification de décision de l’INTEC. Une UE dispensée n’est ni suivie ni facturée.</p>
        <div class="flex flex-wrap gap-2">
            <label v-for="ue in uesProposees" :key="ue.id" class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-surface px-3 py-1.5 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/70">
                <input v-model="valeurs.ueDispenseesIds" type="checkbox" :value="ue.id" />
                <strong class="font-semibold text-gray-900">{{ ue.code }}</strong>
            </label>
        </div>
        <p v-if="erreurs.ueDispenseesIds" class="mt-1 block text-xs text-red-600">{{ erreurs.ueDispenseesIds }}</p>
    </div>
    <p v-if="tarif !== null" class="mt-5 rounded-xl bg-insec-50/60 px-4 py-3 text-sm text-gray-700 ring-1 ring-insec-600/10">
        Montant au tarif :
        <strong class="text-gray-900 tabular-nums">{{ formaterMontant(tarif) }} MRU</strong>
        <span class="text-gray-500">
            ({{ valeurs.ueIds.length }} {{ estCertificat ? 'certificat(s)' : 'UE' }} × {{ formaterMontant(prixUnitaire) }} MRU<template v-if="fraisValidation"> + {{ formaterMontant(fraisValidation) }} MRU de validation des acquis</template>)
        </span>
    </p>
</template>
