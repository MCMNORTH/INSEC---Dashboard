<script setup lang="ts">
import { MIME_PIECES, STATUTS_PIECE, TAILLE_MAX_PIECE, TYPES_PIECE } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { ref as refStockage, uploadBytes } from 'firebase/storage';
import { computed, reactive, ref } from 'vue';
import { appeler } from '../../api';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import { useDocument, useRequete } from '../../donnees';
import { telecharger } from '../../fichiers';
import { db, stockage } from '../../firebase';
import { date } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Etudiant, Inscription, Piece, Versement } from '../../types';

const props = defineProps<{ id: string }>();
const { formation, annee } = useReferentiel();
const { donnee: etudiant, chargement } = useDocument<Etudiant>(() => `etudiants/${props.id}`);
const { donnees: piecesBrutes } = useRequete<Piece>(() => query(collection(db, 'pieces'), where('etudiantId', '==', props.id)));
const { donnees: inscriptions } = useRequete<Inscription>(() => query(collection(db, 'inscriptions'), where('etudiantId', '==', props.id)));
const { donnees: versements } = useRequete<Versement>(() => query(collection(db, 'versements'), where('etudiantId', '==', props.id)));
const pieces = computed(() => [...piecesBrutes.value].sort((a, b) => (b.creeLe?.toMillis() ?? 0) - (a.creeLe?.toMillis() ?? 0)));
const edition = reactive<Record<string, { statut: string; note: string }>>({});
const valeur = (p: Piece) => (edition[p.id] ??= { statut: p.statut, note: p.note ?? '' });

const { envoi, erreurs, soumettre } = useFormulaire();
const nouvelle = reactive({ type: TYPES_PIECE[0] as string, dateExpiration: '', note: '' });
const fichier = ref<File | null>(null);
const champFichier = ref<HTMLInputElement>();

async function ajouter() {
    const f = fichier.value;
    if (!f) return;
    if (!MIME_PIECES.includes(f.type as never) || f.size > TAILLE_MAX_PIECE) {
        notifier('Seuls les fichiers PDF, JPG ou PNG de 5 Mo maximum sont acceptés.', { type: 'erreur' });
        return;
    }
    const resultat = await soumettre(async () => {
        const nomSur = f.name.replace(/[^\w.-]+/g, '_').slice(-120);
        const chemin = `dossiers/${props.id}/${crypto.randomUUID()}-${nomSur}`;
        await uploadBytes(refStockage(stockage, chemin), f, { contentType: f.type });
        return appeler('enregistrerPiece', { etudiantId: props.id, chemin, nomOriginal: f.name, ...nouvelle });
    });
    if (!resultat) return;
    notifier(resultat.message ?? 'Pièce ajoutée au dossier.');
    Object.assign(nouvelle, { dateExpiration: '', note: '' });
    fichier.value = null;
    if (champFichier.value) champFichier.value.value = '';
}

async function mettreAJour(piece: Piece) {
    const resultat = await soumettre(() => appeler('modifierPiece', { id: piece.id, ...valeur(piece) }));
    if (resultat) notifier(resultat.message ?? 'Statut mis à jour.');
}

const generer = (operation: string, donnees: object) => soumettre(() => telecharger(operation, donnees));
</script>

<template>
    <RouterLink :to="`/etudiants/${id}`" class="text-sm text-gray-500">← Retour à la fiche</RouterLink>
    <h1 class="mt-2 text-xl font-bold text-insec">Dossier documentaire</h1>
    <p class="mb-5 text-gray-600">{{ etudiant?.prenom }} {{ etudiant?.nom }}</p>
    <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
        <div class="grid gap-5 lg:grid-cols-3">
            <section class="carte p-5 lg:col-span-2">
                <h2 class="mb-3 font-bold text-insec">Pièces administratives</h2>
                <div class="space-y-3">
                    <div v-for="piece in pieces" :key="piece.id" class="rounded-lg border p-3">
                        <div class="flex justify-between gap-3">
                            <div>
                                <strong>{{ piece.type }}</strong> <BadgeStatut :statut="piece.statut" class="ml-2" />
                                <p class="text-xs text-gray-500">{{ piece.nomOriginal }} · {{ Math.round(piece.taille / 1024) }} Ko<template v-if="piece.dateExpiration"> · expire le {{ date(piece.dateExpiration) }}</template></p>
                            </div>
                            <button class="cursor-pointer text-sm text-blue-700" :disabled="envoi" @click="generer('telechargerPiece', { id: piece.id })">Télécharger</button>
                        </div>
                        <form class="mt-3 flex flex-wrap gap-2" @submit.prevent="mettreAJour(piece)">
                            <select v-model="valeur(piece).statut" class="champ w-auto">
                                <option v-for="s in STATUTS_PIECE" :key="s">{{ s }}</option>
                            </select>
                            <input v-model="valeur(piece).note" placeholder="Note" class="champ min-w-[150px] flex-1" maxlength="1000" />
                            <button class="bouton bg-gray-100" :disabled="envoi">Mettre à jour</button>
                        </form>
                    </div>
                    <p v-if="!pieces.length" class="text-gray-500">Aucune pièce déposée.</p>
                </div>
            </section>
            <aside class="carte p-5">
                <h2 class="mb-3 font-bold text-insec">Ajouter une pièce</h2>
                <form class="space-y-3" @submit.prevent="ajouter">
                    <select v-model="nouvelle.type" class="champ" aria-label="Type de pièce">
                        <option v-for="t in TYPES_PIECE" :key="t">{{ t }}</option>
                    </select>
                    <input ref="champFichier" type="file" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm" required @change="fichier = ($event.target as HTMLInputElement).files?.[0] ?? null" />
                    <p v-if="erreurs.fichier" class="text-xs text-red-600">{{ erreurs.fichier }}</p>
                    <label class="etiquette">Date d’expiration <input v-model="nouvelle.dateExpiration" type="date" class="champ mt-1" /></label>
                    <textarea v-model="nouvelle.note" placeholder="Note interne" class="champ" maxlength="1000"></textarea>
                    <button class="bouton-action w-full" :disabled="envoi">Ajouter</button>
                </form>
            </aside>
        </div>

        <h2 class="mt-7 mb-3 font-bold text-insec">Documents générés</h2>
        <div class="grid gap-4 md:grid-cols-2">
            <div v-for="i in inscriptions" :key="i.id" class="carte p-4">
                <strong>{{ formation(i.formationId)?.code }} · {{ annee(i.anneeId)?.libelle }}</strong>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button class="bouton bg-blue-50 text-blue-800" :disabled="envoi" @click="generer('genererPdf', { type: 'attestation', id: i.id })">Attestation d’inscription</button>
                    <button class="bouton bg-green-50 text-green-800" :disabled="envoi" @click="generer('genererPdf', { type: 'releve', id: i.id })">Relevé de notes</button>
                    <button
                        v-for="v in versements.filter((v) => v.inscriptionId === i.id)"
                        :key="v.id"
                        class="bouton bg-amber-50 text-amber-800"
                        :disabled="envoi"
                        @click="generer('genererPdf', { type: 'recu', id: v.id })"
                    >Reçu {{ v.numeroRecu }}</button>
                </div>
            </div>
        </div>
    </Chargement>
</template>
