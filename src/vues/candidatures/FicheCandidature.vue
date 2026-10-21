<script setup lang="ts">
import { DECISIONS_CANDIDATURE } from '@shared/domaine';
import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import { useDocument } from '../../donnees';
import { aujourdhui, date } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Candidature } from '../../types';

const props = defineProps<{ id: string }>();
const router = useRouter();
const { formation, annee } = useReferentiel();
const { donnee: c, chargement } = useDocument<Candidature>(() => `candidatures/${props.id}`);
const decision = reactive({ statut: '', noteInterne: '' });
const initialise = ref(false);
watch(c, (v) => {
    if (v && !initialise.value) {
        Object.assign(decision, { statut: v.statut === 'Inscrite' ? 'Admissible' : v.statut, noteInterne: v.noteInterne ?? '' });
        initialise.value = true;
    }
}, { immediate: true });
const conversion = reactive({ anneeParcours: 1, dateInscription: aujourdhui(), numeroIntec: '', montantDu: null as number | null });
const { envoi, erreurs, soumettre } = useFormulaire();

async function decider() {
    const resultat = await soumettre(() => appeler('deciderCandidature', { id: props.id, ...decision }));
    if (resultat) notifier(resultat.message ?? 'Décision enregistrée.');
}

async function convertir() {
    const resultat = await soumettre(() => appeler<{ etudiantId: string; message: string }>('convertirCandidature', { id: props.id, ...conversion }));
    if (!resultat) return;
    notifier(resultat.message, { apresNavigation: true });
    await router.push(`/etudiants/${resultat.etudiantId}`);
}
</script>

<template>
    <RouterLink to="/candidatures" class="text-sm text-gray-500">← Retour aux candidatures</RouterLink>
    <Chargement :chargement="chargement" :vide="!c" message-vide="Candidature introuvable.">
        <template v-if="c">
            <div class="mt-3 mb-6 flex flex-wrap justify-between gap-3">
                <div>
                    <h1 class="titre-page">{{ c.prenom }} {{ c.nom }}</h1>
                    <p class="text-sm text-gray-500">{{ c.reference }} · {{ formation(c.formationId)?.code }} · {{ annee(c.anneeId)?.libelle }}</p>
                </div>
                <BadgeStatut :statut="c.statut" class="h-fit" />
            </div>
            <div class="grid gap-5 lg:grid-cols-3">
                <section class="space-y-5 lg:col-span-2">
                    <article class="rounded-xl border bg-white p-5">
                        <h2 class="mb-4 font-bold text-insec">Informations du candidat</h2>
                        <dl class="grid gap-4 text-sm md:grid-cols-2">
                            <div><dt class="text-gray-400">E-mail</dt><dd>{{ c.email }}</dd></div>
                            <div><dt class="text-gray-400">Téléphone</dt><dd>{{ c.telephone }}</dd></div>
                            <div><dt class="text-gray-400">Date de naissance</dt><dd>{{ c.dateNaissance ? date(c.dateNaissance) : '—' }}</dd></div>
                            <div><dt class="text-gray-400">Dernier diplôme</dt><dd>{{ c.dernierDiplome }}</dd></div>
                        </dl>
                        <div v-if="c.motivation" class="mt-5"><p class="text-sm text-gray-400">Motivation</p><p class="mt-1 text-sm whitespace-pre-line">{{ c.motivation }}</p></div>
                        <RouterLink v-if="c.etudiantId" :to="`/etudiants/${c.etudiantId}`" class="mt-4 inline-block text-sm font-semibold text-insec">Voir le dossier étudiant →</RouterLink>
                    </article>
                    <article v-if="c.statut === 'Admissible'" class="rounded-xl border border-insec-or bg-white p-5">
                        <h2 class="font-bold text-insec">Créer l’inscription définitive</h2>
                        <p class="mt-1 mb-4 text-sm text-gray-500">Toutes les UE actives de l’année de parcours choisie seront rattachées.</p>
                        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="convertir">
                            <label class="etiquette">Année de parcours
                                <select v-model.number="conversion.anneeParcours" class="champ mt-1">
                                    <option v-for="i in formation(c.formationId)?.dureeAnnees ?? 1" :key="i" :value="i">Année {{ i }}</option>
                                </select>
                            </label>
                            <label class="etiquette">Date d’inscription <input v-model="conversion.dateInscription" type="date" class="champ mt-1" required /></label>
                            <label class="etiquette">N° INTEC <input v-model="conversion.numeroIntec" class="champ mt-1" maxlength="100" /></label>
                            <label class="etiquette">Montant dû (MRU) <input v-model.number="conversion.montantDu" type="number" min="0" class="champ mt-1" required /></label>
                            <p v-if="erreurs.anneeParcours" class="text-xs text-red-600 md:col-span-2">{{ erreurs.anneeParcours }}</p>
                            <button class="bouton-principal py-3 md:col-span-2" :disabled="envoi">Créer l’étudiant et son inscription</button>
                        </form>
                    </article>
                </section>
                <aside>
                    <form class="space-y-4 rounded-xl border bg-white p-5" @submit.prevent="decider">
                        <h2 class="font-bold text-insec">Décision administrative</h2>
                        <label class="etiquette">Statut
                            <select v-model="decision.statut" class="champ mt-1" :disabled="c.statut === 'Inscrite'">
                                <option v-for="s in DECISIONS_CANDIDATURE" :key="s">{{ s }}</option>
                            </select>
                        </label>
                        <label class="etiquette">Note interne <textarea v-model="decision.noteInterne" rows="5" class="champ mt-1" maxlength="2000"></textarea></label>
                        <button v-if="c.statut !== 'Inscrite'" class="bouton w-full bg-gray-800 text-white" :disabled="envoi">Enregistrer la décision</button>
                        <p v-else class="text-sm text-green-700">Dossier converti en étudiant.</p>
                    </form>
                </aside>
            </div>
        </template>
    </Chargement>
</template>
