<script setup lang="ts">
import { STATUTS_ETUDIANT } from '@shared/domaine';

export interface Identite {
    nom: string;
    prenom: string;
    email: string;
    dateNaissance: string;
    telephone: string;
    statut: string;
}

defineProps<{ erreurs: Record<string, string> }>();
const valeurs = defineModel<Identite>({ required: true });
</script>

<template>
    <div class="grid gap-4 md:grid-cols-2">
        <label class="etiquette">Nom
            <input v-model="valeurs.nom" class="champ mt-1" required maxlength="255" />
            <span v-if="erreurs.nom" class="text-xs text-red-600">{{ erreurs.nom }}</span>
        </label>
        <label class="etiquette">Prénom
            <input v-model="valeurs.prenom" class="champ mt-1" required maxlength="255" />
            <span v-if="erreurs.prenom" class="text-xs text-red-600">{{ erreurs.prenom }}</span>
        </label>
        <label class="etiquette">E-mail <span class="text-gray-400">(facultatif)</span>
            <input v-model="valeurs.email" type="email" class="champ mt-1" />
            <span v-if="erreurs.email" class="text-xs text-red-600">{{ erreurs.email }}</span>
        </label>
        <label class="etiquette">Date de naissance <span class="text-gray-400">(facultative)</span>
            <input v-model="valeurs.dateNaissance" type="date" class="champ mt-1" />
        </label>
        <label class="etiquette">Téléphone
            <input v-model="valeurs.telephone" type="tel" class="champ mt-1" maxlength="30" />
        </label>
        <label class="etiquette">Statut
            <select v-model="valeurs.statut" class="champ mt-1">
                <option v-for="s in STATUTS_ETUDIANT" :key="s">{{ s }}</option>
            </select>
        </label>
    </div>
</template>
