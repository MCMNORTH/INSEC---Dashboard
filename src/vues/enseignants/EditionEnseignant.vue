<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { useDocument } from '../../donnees';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import type { Enseignant } from '../../types';

const props = defineProps<{ id?: string }>();
const router = useRouter();
const { donnee: enseignant, chargement } = useDocument<Enseignant>(() => (props.id ? `enseignants/${props.id}` : null));
const fiche = ref(props.id ? null : { nom: '', prenom: '', specialite: '', email: '', telephone: '' });
watch(enseignant, (e) => {
    if (e && !fiche.value) fiche.value = { nom: e.nom, prenom: e.prenom, specialite: e.specialite, email: e.email, telephone: e.telephone ?? '' };
}, { immediate: true });
const { envoi, erreurs, soumettre } = useFormulaire();
const champs = [['nom', 'Nom', 'text'], ['prenom', 'Prénom', 'text'], ['specialite', 'Spécialité', 'text'], ['email', 'E-mail', 'email'], ['telephone', 'Téléphone', 'tel']] as const;

async function enregistrer() {
    const resultat = await soumettre(() => (props.id ? appeler('modifierEnseignant', { id: props.id, ...fiche.value }) : appeler('creerEnseignant', fiche.value!)));
    if (!resultat) return;
    notifier(resultat.message ?? 'Enseignant enregistré.', { apresNavigation: true });
    await router.push('/enseignants');
}
</script>

<template>
    <div class="max-w-2xl">
        <RouterLink to="/enseignants" class="text-sm text-gray-500">← Retour à la liste</RouterLink>
        <h1 class="mt-2 mb-5 text-xl font-bold text-insec">{{ id ? 'Modifier l’enseignant' : 'Nouvel enseignant' }}</h1>
        <Chargement :chargement="!!id && chargement" :vide="!!id && !enseignant" message-vide="Enseignant introuvable.">
            <form v-if="fiche" class="carte grid gap-4 p-6 md:grid-cols-2" @submit.prevent="enregistrer">
                <label v-for="[cle, libelle, type] in champs" :key="cle" class="etiquette">{{ libelle }}
                    <input v-model="fiche[cle]" :type="type" class="champ mt-1" :required="cle !== 'telephone'" maxlength="255" />
                    <span v-if="erreurs[cle]" class="text-xs text-red-600">{{ erreurs[cle] }}</span>
                </label>
                <button class="bouton-action md:col-span-2" :disabled="envoi">Enregistrer</button>
            </form>
        </Chargement>
    </div>
</template>
