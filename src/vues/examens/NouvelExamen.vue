<script setup lang="ts">
import { SESSIONS_EXAMEN } from '@shared/domaine';
import { computed, reactive, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import { instantDepuisDateHeureParis } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';

const router = useRouter();
const { ues, annees, formation } = useReferentiel();
const uesActives = computed(() => [...ues.value].filter((u) => u.active !== false).sort((a, b) => a.code.localeCompare(b.code)));
const { envoi, erreurs, soumettre } = useFormulaire();
const f = reactive({ ueId: '', anneeId: '', session: 'Normale', dateExamen: '', salle: '', noteSur: 20, seuilValidation: 10, statut: 'Planifié' });
watchEffect(() => {
    if (!f.anneeId && annees.value[0]) f.anneeId = annees.value[0].id;
});

async function enregistrer() {
    // Les horaires INTEC sont exprimés à Paris, quel que soit le fuseau du navigateur.
    const dateExamen = f.dateExamen ? instantDepuisDateHeureParis(f.dateExamen) : null;
    if (!dateExamen) {
        notifier('Cette date ou cette heure n’est pas valide dans le calendrier de Paris.');
        return;
    }
    const resultat = await soumettre(() => appeler<{ id: string; message: string }>('creerExamen', { ...f, dateExamen }));
    if (!resultat) return;
    notifier(resultat.message, { apresNavigation: true });
    await router.push(`/examens/${resultat.id}`);
}
</script>

<template>
    <div class="max-w-3xl">
        <RouterLink to="/examens" class="text-sm text-gray-500">← Retour</RouterLink>
        <h1 class="mt-2 mb-5 text-xl font-bold text-insec">Planifier un examen</h1>
        <form class="carte grid gap-4 p-6 md:grid-cols-2" @submit.prevent="enregistrer">
            <label class="etiquette md:col-span-2">UE
                <select v-model="f.ueId" class="champ mt-1" required>
                    <option value="">Sélectionner…</option>
                    <option v-for="ue in uesActives" :key="ue.id" :value="ue.id">{{ formation(ue.formationId)?.code }} · {{ ue.code }} — {{ ue.libelle }}</option>
                </select>
            </label>
            <label class="etiquette">Année académique
                <select v-model="f.anneeId" class="champ mt-1"><option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option></select>
            </label>
            <label class="etiquette">Session
                <select v-model="f.session" class="champ mt-1"><option v-for="s in SESSIONS_EXAMEN" :key="s">{{ s }}</option></select>
            </label>
            <label class="etiquette">Date et heure (Paris)
                <input v-model="f.dateExamen" type="datetime-local" class="champ mt-1" required />
                <span class="mt-1 block text-xs text-gray-500">L’heure est enregistrée selon le fuseau Europe/Paris (heure d’hiver ou d’été).</span>
                <span v-if="erreurs.dateExamen" class="text-xs text-red-600">{{ erreurs.dateExamen }}</span>
            </label>
            <label class="etiquette">Salle / lien <input v-model="f.salle" class="champ mt-1" maxlength="100" /></label>
            <label class="etiquette">Note sur <input v-model.number="f.noteSur" type="number" step="0.01" min="1" max="100" class="champ mt-1" required /></label>
            <label class="etiquette">Seuil de validation
                <input v-model.number="f.seuilValidation" type="number" step="0.01" min="0" class="champ mt-1" required />
                <span v-if="erreurs.seuilValidation" class="text-xs text-red-600">{{ erreurs.seuilValidation }}</span>
            </label>
            <p class="text-sm text-gray-500 md:col-span-2">Les étudiants inscrits à cette UE pendant l’année choisie seront convoqués automatiquement.</p>
            <button class="bouton-action md:col-span-2" :disabled="envoi">Créer et convoquer</button>
        </form>
    </div>
</template>
