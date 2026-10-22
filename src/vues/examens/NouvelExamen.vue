<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../../api';
import { horaireExamen, instantDepuisDateHeureParis } from '../../format';
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
const dateHeureOfficielle = computed(() => dateHeureIso.value ? horaireExamen(dateHeureIso.value) : 'Date officielle invalide');
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
        <RouterLink to="/examens" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour au calendrier INTEC</RouterLink>
        <header class="en-tete-page">
            <div>
                <p class="surtitre">Examens INTEC</p>
                <h1 class="titre-page mt-1.5">Ouvrir le suivi local</h1>
                <p class="sous-titre">L’INTEC fixe l’épreuve et son horaire. Cette fiche sert uniquement au suivi des opérations de l’INSEC.</p>
            </div>
        </header>
        <form v-if="route.query.source === 'intec'" class="carte overflow-hidden" @submit.prevent="enregistrer">
            <header class="panneau-entete">
                <div>
                    <h2 class="titre-section">Épreuve sélectionnée</h2>
                    <p class="mt-0.5 text-xs text-gray-500">Informations issues du calendrier officiel INTEC</p>
                </div>
                <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><i class="fa-solid fa-lock text-[10px]"></i>Calendrier INTEC</span>
            </header>
            <div class="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <div class="etiquette md:col-span-2">Épreuve INTEC
                    <p class="champ mt-1.5 bg-gray-50 font-semibold text-gray-900">{{ ue(f.ueId)?.code }} — {{ ue(f.ueId)?.libelle }}</p>
                </div>
                <div class="etiquette">Année scolaire
                    <p class="champ mt-1.5 bg-gray-50">{{ annee(f.anneeId)?.libelle || libelleAnnee }}</p>
                </div>
                <div class="etiquette">Session INTEC
                    <p class="champ mt-1.5 bg-gray-50">Normale</p>
                </div>
                <div class="etiquette">Date et heure officielles
                    <p class="champ mt-1.5 bg-gray-50">{{ dateHeureOfficielle }}</p>
                    <span class="mt-1.5 block text-xs font-normal text-gray-500">Cette date provient du calendrier INTEC et ne peut pas être modifiée ici.</span>
                    <span v-if="erreurs.dateExamen" class="text-xs text-red-600">{{ erreurs.dateExamen }}</span>
                </div>
                <label class="etiquette">Salle / lieu (organisation INSEC)
                    <input v-model="f.salle" class="champ mt-1.5" maxlength="100" placeholder="À renseigner quand la salle est connue" />
                </label>
                <p class="flex items-start gap-3 rounded-2xl border border-insec-100 bg-insec-50/60 p-4 text-sm leading-6 text-insec-700 md:col-span-2">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-insec-100 text-insec-600"><i class="fa-solid fa-circle-info text-xs"></i></span>
                    <span>Ouvrir ce suivi ne change pas le calendrier de l’INTEC et n’envoie aucun e-mail. La fiche sert à suivre les candidats, les convocations locales, la réception des sujets et le retour des copies.</span>
                </p>
            </div>
            <div class="flex justify-end border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
                <button class="bouton-action" :disabled="envoi || !suiviValide">Ouvrir le suivi INSEC <i class="fa-solid fa-arrow-right text-xs"></i></button>
            </div>
        </form>
        <div v-else class="carte flex flex-col items-center px-6 py-12 text-center">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-calendar-check"></i></span>
            <p class="mt-3 text-sm text-gray-600">Sélectionnez une épreuve depuis le calendrier officiel de l’INTEC.</p>
        </div>
    </div>
</template>
