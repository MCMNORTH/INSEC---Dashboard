<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../../api';
import { dateHeureParis, instantDepuisDateHeureParis } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';

const router = useRouter();
const route = useRoute();
const { ues, annees, anneeCourante, ue, annee } = useReferentiel();
const { envoi, erreurs, soumettre } = useFormulaire();
const f = reactive({ ueId: '', anneeId: '', session: 'Normale', dateExamen: '', salle: '', noteSur: 20, seuilValidation: 10, statut: 'Planifié' });
const codeUE = computed(() => typeof route.query.ue === 'string' ? route.query.ue : '');
const libelleAnnee = computed(() => typeof route.query.annee === 'string' ? route.query.annee : '');
const dateHeureIso = computed(() => instantDepuisDateHeureParis(f.dateExamen));
const dateHeureOfficielle = computed(() => dateHeureIso.value ? dateHeureParis(dateHeureIso.value) : 'Date officielle invalide');
const suiviValide = computed(() => route.query.source === 'intec' && !!f.ueId && !!f.anneeId && !!dateHeureIso.value);

watchEffect(() => {
    if (route.query.source !== 'intec') return;
    const codeCatalogue = codeUE.value ? `TEC${codeUE.value}` : '';
    const ueOfficielle = ues.value.find((u) => u.code === codeCatalogue);
    if (ueOfficielle) f.ueId = ueOfficielle.id;
    const anneeOfficielle = annees.value.find((a) => a.libelle === libelleAnnee.value);
    if (anneeOfficielle) f.anneeId = anneeOfficielle.id;
    else if (!f.anneeId && anneeCourante.value) f.anneeId = anneeCourante.value.id;
    if (typeof route.query.dateHeure === 'string') f.dateExamen = route.query.dateHeure;
    f.session = 'Normale';
});

async function enregistrer() {
    if (!suiviValide.value) {
        notifier('Impossible d’ouvrir le suivi : vérifiez l’épreuve et le calendrier INTEC sélectionnés.');
        return;
    }
    const resultat = await soumettre(() => appeler<{ id: string; message: string }>('creerExamen', {
        ...f,
        codeUE: codeUE.value,
        annee: libelleAnnee.value,
        dateExamen: dateHeureIso.value,
    }));
    if (!resultat) return;
    notifier(resultat.message, { apresNavigation: true });
    await router.push(`/examens/${resultat.id}`);
}
</script>

<template>
    <div class="max-w-3xl">
        <RouterLink to="/examens" class="text-sm text-gray-500">← Retour au calendrier INTEC</RouterLink>
        <h1 class="mt-2 mb-2 text-xl font-bold text-insec">Ouvrir le suivi local</h1>
        <p class="mb-5 text-sm text-gray-600">L’INTEC fixe l’épreuve et son horaire. Cette fiche sert uniquement au suivi des opérations de l’INSEC.</p>
        <form v-if="route.query.source === 'intec'" class="carte grid gap-4 p-6 md:grid-cols-2" @submit.prevent="enregistrer">
            <div class="etiquette md:col-span-2">Épreuve INTEC
                <p class="champ mt-1 bg-gray-50">{{ ue(f.ueId)?.code }} — {{ ue(f.ueId)?.libelle }}</p>
            </div>
            <div class="etiquette">Année académique
                <p class="champ mt-1 bg-gray-50">{{ annee(f.anneeId)?.libelle || libelleAnnee }}</p>
            </div>
            <div class="etiquette">Session INTEC
                <p class="champ mt-1 bg-gray-50">Normale</p>
            </div>
            <div class="etiquette">Date et heure officielles (Paris)
                <p class="champ mt-1 bg-gray-50">{{ dateHeureOfficielle }}</p>
                <span class="mt-1 block text-xs text-gray-500">Cette date provient du calendrier INTEC et ne peut pas être modifiée ici.</span>
                <span v-if="erreurs.dateExamen" class="text-xs text-red-600">{{ erreurs.dateExamen }}</span>
            </div>
            <label class="etiquette">Salle / lieu (organisation INSEC)
                <input v-model="f.salle" class="champ mt-1" maxlength="100" placeholder="À renseigner quand la salle est connue" />
            </label>
            <p class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 md:col-span-2">
                Ouvrir ce suivi ne change pas le calendrier de l’INTEC et n’envoie aucun e-mail. La fiche sert à suivre les candidats, les convocations locales, la réception des sujets et le retour des copies.
            </p>
            <button class="bouton-action md:col-span-2" :disabled="envoi || !suiviValide">Ouvrir le suivi INSEC</button>
        </form>
        <div v-else class="carte p-6 text-gray-600">Sélectionnez une épreuve depuis le calendrier officiel de l’INTEC.</div>
    </div>
</template>