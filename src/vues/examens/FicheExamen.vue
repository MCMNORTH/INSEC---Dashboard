<script setup lang="ts">
import { PRESENCES } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { computed, reactive } from 'vue';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { indexer, useDocument, useRequete } from '../../donnees';
import { telecharger } from '../../fichiers';
import { db } from '../../firebase';
import { dateHeure, nomComplet } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Etudiant, Examen, Inscription, Resultat } from '../../types';

const props = defineProps<{ id: string }>();
const { ue, annee, formation } = useReferentiel();
const { donnee: examen, chargement } = useDocument<Examen>(() => `examens/${props.id}`);
const { donnees: resultats } = useRequete<Resultat>(() => query(collection(db, 'resultats'), where('examenId', '==', props.id)));
const { donnees: etudiants } = useRequete<Etudiant>(() => collection(db, 'etudiants'));
const { donnees: inscriptions } = useRequete<Inscription>(() => (examen.value ? query(collection(db, 'inscriptions'), where('anneeId', '==', examen.value.anneeId)) : null));
const parEtudiant = computed(() => indexer(etudiants.value));
const parInscription = computed(() => indexer(inscriptions.value));
const lignes = computed(() =>
    [...resultats.value].sort((a, b) => nomComplet(parEtudiant.value.get(a.etudiantId)).localeCompare(nomComplet(parEtudiant.value.get(b.etudiantId)))),
);

const saisie = reactive<Record<string, { presence: string; note: number | '' | null; commentaire: string }>>({});
const valeur = (r: Resultat) => (saisie[r.id] ??= { presence: r.presence, note: r.note ?? '', commentaire: r.commentaire ?? '' });
const { envoi, erreurs, soumettre } = useFormulaire();
const enCours = reactive({ id: '' });

async function enregistrer(r: Resultat) {
    enCours.id = r.id;
    const resultat = await soumettre(() => appeler('enregistrerResultat', { id: r.id, ...valeur(r) }));
    if (resultat) notifier(resultat.message ?? 'Résultat enregistré.');
}
</script>

<template>
    <RouterLink to="/examens" class="text-sm text-gray-500">← Retour</RouterLink>
    <Chargement :chargement="chargement" :vide="!examen" message-vide="Examen introuvable.">
        <template v-if="examen">
            <section class="carte mt-4 p-5">
                <p class="text-sm font-semibold text-amber-600">{{ formation(examen.formationId)?.code }} · {{ annee(examen.anneeId)?.libelle }}</p>
                <h1 class="text-xl font-bold text-insec">{{ ue(examen.ueId)?.code }} — {{ ue(examen.ueId)?.libelle }}</h1>
                <div class="mt-4 grid gap-3 text-sm md:grid-cols-4">
                    <div><span class="text-gray-500">Date</span><br /><strong>{{ dateHeure(examen.dateExamen) }}</strong></div>
                    <div><span class="text-gray-500">Session</span><br /><strong>{{ examen.session }}</strong></div>
                    <div><span class="text-gray-500">Salle</span><br /><strong>{{ examen.salle || '—' }}</strong></div>
                    <div><span class="text-gray-500">Validation</span><br /><strong>{{ examen.seuilValidation }}/{{ examen.noteSur }}</strong></div>
                </div>
            </section>
            <h2 class="mt-7 mb-3 font-bold text-insec">Convocations et résultats ({{ resultats.length }})</h2>
            <div class="space-y-3">
                <form v-for="r in lignes" :key="r.id" class="carte grid items-end gap-3 p-4 md:grid-cols-7" @submit.prevent="enregistrer(r)">
                    <div class="md:col-span-2">
                        <p class="font-semibold">{{ nomComplet(parEtudiant.get(r.etudiantId)) }}</p>
                        <p class="text-xs text-gray-500">N° INTEC {{ parInscription.get(r.inscriptionId)?.numeroIntec || '—' }}</p>
                    </div>
                    <label class="text-xs text-gray-500">Présence
                        <select v-model="valeur(r).presence" class="champ mt-1"><option v-for="p in PRESENCES" :key="p">{{ p }}</option></select>
                    </label>
                    <label class="text-xs text-gray-500">Note / {{ examen.noteSur }}
                        <input v-model="valeur(r).note" type="number" step="0.01" min="0" :max="examen.noteSur" class="champ mt-1" />
                    </label>
                    <label class="text-xs text-gray-500">Commentaire <input v-model="valeur(r).commentaire" class="champ mt-1" maxlength="1000" /></label>
                    <button class="bouton-principal" :disabled="envoi">Enregistrer</button>
                    <button type="button" class="bouton-secondaire" :disabled="envoi" title="Convocation PDF" @click="soumettre(() => telecharger('genererPdf', { type: 'convocation', id: r.id }))">
                        <i class="fa-solid fa-file-pdf"></i> Convocation
                    </button>
                    <p v-if="enCours.id === r.id && erreurs.note" class="text-xs text-red-600 md:col-span-7">{{ erreurs.note }}</p>
                    <p v-if="r.presence === 'Présent' && r.note !== null" :class="['text-xs md:col-span-7', r.valide ? 'text-green-700' : 'text-red-700']">
                        {{ r.valide ? 'UE validée' : 'UE non validée' }}
                    </p>
                </form>
                <div v-if="!resultats.length" class="carte p-6 text-gray-500">Aucun étudiant inscrit à cette UE pour cette année.</div>
            </div>
        </template>
    </Chargement>
</template>
