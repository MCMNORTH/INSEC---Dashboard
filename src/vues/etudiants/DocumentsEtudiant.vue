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
    <RouterLink :to="`/etudiants/${id}`" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à la fiche</RouterLink>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">{{ etudiant?.prenom }} {{ etudiant?.nom }}</p>
            <h1 class="titre-page mt-1.5">Dossier documentaire</h1>
            <p class="sous-titre">Pièces administratives déposées et documents générés pour chaque inscription.</p>
        </div>
    </header>
    <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
        <div class="grid items-start gap-6 lg:grid-cols-3">
            <section class="carte overflow-hidden lg:col-span-2">
                <header class="panneau-entete">
                    <div>
                        <h2 class="titre-section">Pièces administratives</h2>
                        <p class="mt-0.5 text-xs text-gray-500">Vérifiez chaque pièce et indiquez son statut.</p>
                    </div>
                    <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ pieces.length }} pièce(s)</span>
                </header>
                <div v-if="pieces.length" class="divide-y divide-gray-100">
                    <div v-for="piece in pieces" :key="piece.id" class="px-5 py-4 sm:px-6">
                        <div class="flex items-start gap-3">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-200"><i class="fa-regular fa-file-lines"></i></span>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <strong class="text-sm font-semibold text-gray-900">{{ piece.type }}</strong>
                                    <BadgeStatut :statut="piece.statut" />
                                </div>
                                <p class="mt-0.5 truncate text-xs text-gray-500">{{ piece.nomOriginal }} · {{ Math.round(piece.taille / 1024) }} Ko<template v-if="piece.dateExpiration"> · expire le {{ date(piece.dateExpiration) }}</template></p>
                            </div>
                            <button class="bouton-secondaire min-h-9 px-3 text-xs" :disabled="envoi" @click="generer('telechargerPiece', { id: piece.id })">
                                <i class="fa-solid fa-download text-[11px]"></i> Télécharger
                            </button>
                        </div>
                        <form class="mt-3 flex flex-wrap gap-2 pl-[52px]" @submit.prevent="mettreAJour(piece)">
                            <select v-model="valeur(piece).statut" class="champ w-auto py-2">
                                <option v-for="s in STATUTS_PIECE" :key="s">{{ s }}</option>
                            </select>
                            <input v-model="valeur(piece).note" placeholder="Note" class="champ min-w-[150px] flex-1 py-2" maxlength="1000" />
                            <button class="bouton-secondaire" :disabled="envoi">Mettre à jour</button>
                        </form>
                    </div>
                </div>
                <div v-else class="flex flex-col items-center px-6 py-12 text-center">
                    <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><i class="fa-regular fa-folder-open"></i></span>
                    <p class="mt-3 text-sm text-gray-500">Aucune pièce déposée.</p>
                </div>
            </section>
            <aside class="carte overflow-hidden lg:sticky lg:top-24">
                <header class="panneau-entete">
                    <div>
                        <h2 class="titre-section">Ajouter une pièce</h2>
                        <p class="mt-0.5 text-xs text-gray-500">PDF, JPG ou PNG · 5 Mo maximum</p>
                    </div>
                </header>
                <form class="space-y-4 p-5" @submit.prevent="ajouter">
                    <label class="etiquette">Type de pièce
                        <select v-model="nouvelle.type" class="champ mt-1.5" aria-label="Type de pièce">
                            <option v-for="t in TYPES_PIECE" :key="t">{{ t }}</option>
                        </select>
                    </label>
                    <label class="etiquette">Fichier
                        <input ref="champFichier" type="file" accept=".pdf,.jpg,.jpeg,.png" class="champ mt-1.5 py-2 text-sm" required @change="fichier = ($event.target as HTMLInputElement).files?.[0] ?? null" />
                        <span v-if="erreurs.fichier" class="mt-1 block text-xs text-red-600">{{ erreurs.fichier }}</span>
                    </label>
                    <label class="etiquette">Date d’expiration <input v-model="nouvelle.dateExpiration" type="date" class="champ mt-1.5" /></label>
                    <label class="etiquette">Note interne
                        <textarea v-model="nouvelle.note" placeholder="Note interne" class="champ mt-1.5" maxlength="1000"></textarea>
                    </label>
                    <button class="bouton-action w-full" :disabled="envoi"><i class="fa-solid fa-upload text-xs"></i> Ajouter</button>
                </form>
            </aside>
        </div>

        <section class="mt-8">
            <h2 class="titre-section mb-3">Documents générés</h2>
            <div class="grid gap-4 md:grid-cols-2">
                <div v-for="i in inscriptions" :key="i.id" class="carte p-5">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-file-pdf text-sm"></i></span>
                        <strong class="text-sm font-semibold text-gray-900">{{ formation(i.formationId)?.code }} · {{ annee(i.anneeId)?.libelle }}</strong>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button class="bouton-secondaire min-h-9 px-3 text-xs" :disabled="envoi" @click="generer('genererPdf', { type: 'attestation', id: i.id })"><i class="fa-solid fa-file-signature text-[11px] text-insec-500"></i> Attestation d’inscription</button>
                        <button class="bouton-secondaire min-h-9 px-3 text-xs" :disabled="envoi" @click="generer('genererPdf', { type: 'releve', id: i.id })"><i class="fa-solid fa-list-check text-[11px] text-emerald-600"></i> Relevé de notes</button>
                        <button
                            v-for="v in versements.filter((v) => v.inscriptionId === i.id)"
                            :key="v.id"
                            class="bouton-secondaire min-h-9 px-3 text-xs"
                            :disabled="envoi"
                            @click="generer('genererPdf', { type: 'recu', id: v.id })"
                        ><i class="fa-solid fa-receipt text-[11px] text-amber-600"></i> Reçu {{ v.numeroRecu }}</button>
                    </div>
                </div>
                <div v-if="!inscriptions.length" class="carte p-6 text-sm text-gray-500">Aucune inscription.</div>
            </div>
        </section>
    </Chargement>
</template>
