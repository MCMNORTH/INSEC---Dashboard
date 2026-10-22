<script setup lang="ts">
import { TAILLE_MAX_PIECE, TYPES_DOCUMENT_FINANCIER } from '@shared/domaine';
import { ref as refStockage, uploadBytes } from 'firebase/storage';
import { computed, ref, watch } from 'vue';
import { appeler } from '../api';
import { telecharger } from '../fichiers';
import { stockage } from '../firebase';
import { date } from '../format';
import { notifier } from '../notifications';
import { session } from '../session';

type TypeDocument = (typeof TYPES_DOCUMENT_FINANCIER)[number];
interface DocumentFinancier {
    id: string;
    type: TypeDocument;
    nomOriginal: string;
    taille: number;
    deposeLe: string | null;
    ancienFormat: boolean;
}

const props = defineProps<{ anneeId: string; libelleAnnee: string }>();

const RUBRIQUES: { type: TypeDocument; titre: string; aide: string }[] = [
    { type: 'facture-intec', titre: 'Facture annuelle de l’INTEC', aide: 'La facture qui indique le total dû à l’INTEC pour cette année.' },
    { type: 'justificatif-paiement', titre: 'Justificatif du paiement INSEC', aide: 'Le reçu ou le justificatif du règlement de la facture par l’INSEC.' },
];

const documents = ref<DocumentFinancier[]>([]);
const chargement = ref(false);
const erreur = ref('');
const envoi = ref<TypeDocument | null>(null);
const selection = ref<Record<TypeDocument, File[]>>({ 'facture-intec': [], 'justificatif-paiement': [] });

const parType = computed(() => Object.fromEntries(
    TYPES_DOCUMENT_FINANCIER.map((t) => [t, documents.value.filter((d) => d.type === t)]),
) as Record<TypeDocument, DocumentFinancier[]>);

async function charger() {
    if (!props.anneeId) return;
    chargement.value = true;
    erreur.value = '';
    try {
        documents.value = (await appeler<{ documents: DocumentFinancier[] }>('lireDocumentsFinanciers', { anneeId: props.anneeId })).documents;
    } catch {
        erreur.value = 'Les documents financiers n’ont pas pu être chargés.';
    } finally {
        chargement.value = false;
    }
}
watch(() => props.anneeId, () => void charger(), { immediate: true });

function choisir(type: TypeDocument, evenement: Event) {
    selection.value[type] = Array.from((evenement.target as HTMLInputElement).files ?? []);
}

async function deposer(type: TypeDocument) {
    const fichiers = selection.value[type];
    if (!fichiers.length) return notifier('Choisissez au moins un document PDF.', { type: 'erreur' });
    if (fichiers.some((f) => f.type !== 'application/pdf' || f.size > TAILLE_MAX_PIECE)) {
        return notifier('Seuls les fichiers PDF de 5 Mo maximum sont acceptés.', { type: 'erreur' });
    }
    envoi.value = type;
    try {
        for (const f of fichiers) {
            const nom = f.name.normalize('NFD').replace(/[^\w.-]+/g, '-').slice(-80);
            const chemin = `finances/${props.anneeId}/${type}/${session.uid}/${Date.now()}-${nom}`;
            await uploadBytes(refStockage(stockage, chemin), f, { contentType: 'application/pdf' });
            await appeler('enregistrerDocumentFinancier', { anneeId: props.anneeId, type, chemin, nomOriginal: f.name });
        }
        notifier(fichiers.length > 1 ? 'Tous les documents sélectionnés ont été déposés.' : 'Document financier ajouté.');
        selection.value[type] = [];
        await charger();
    } catch {
        notifier('Le dépôt a échoué. Vérifiez le fichier et réessayez.', { type: 'erreur' });
    } finally {
        envoi.value = null;
    }
}

const telechargerDocument = (d: DocumentFinancier) =>
    telecharger('telechargerDocumentFinancier', { id: d.id, ...(d.ancienFormat ? { type: d.type } : {}) })
        .catch(() => notifier('Le document n’a pas pu être téléchargé.', { type: 'erreur' }));
const ko = (octets: number) => `${Math.max(1, Math.round(octets / 1024))} Ko`;
</script>

<template>
    <section class="carte mb-6 overflow-hidden" aria-labelledby="documents-financiers">
        <header class="panneau-entete">
            <div>
                <h2 id="documents-financiers" class="titre-section">Documents financiers · {{ libelleAnnee }}</h2>
                <p class="mt-0.5 text-xs text-gray-500">Facture de l’INTEC et preuve de paiement de l’INSEC pour l’année scolaire, en PDF (5 Mo maximum).</p>
            </div>
        </header>
        <p v-if="erreur" role="alert" class="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-800 sm:mx-6"><i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i>{{ erreur }}</p>
        <div class="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-2">
            <article v-for="r in RUBRIQUES" :key="r.type" class="flex flex-col rounded-xl p-4 ring-1 ring-gray-200/80">
                <div class="flex items-start gap-3">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100"><i class="fa-solid fa-file-pdf text-sm"></i></span>
                    <div>
                        <h3 class="text-sm font-semibold text-gray-900">{{ r.titre }}</h3>
                        <p class="mt-0.5 text-xs text-gray-500">{{ r.aide }}</p>
                    </div>
                </div>
                <p v-if="chargement" class="mt-4 text-sm text-gray-400">Chargement…</p>
                <ul v-else-if="parType[r.type].length" class="mt-4 divide-y divide-gray-100 rounded-xl bg-gray-50/70 px-3 text-sm ring-1 ring-gray-100">
                    <li v-for="d in parType[r.type]" :key="`${d.id}-${d.type}`" class="flex items-center justify-between gap-3 py-2.5">
                        <span class="min-w-0">
                            <span class="block truncate font-medium text-gray-800" :title="d.nomOriginal">{{ d.nomOriginal }}</span>
                            <span class="text-xs text-gray-500">{{ ko(d.taille) }}<template v-if="d.deposeLe"> · déposé le {{ date(d.deposeLe) }}</template></span>
                        </span>
                        <button type="button" class="bouton-icone" title="Télécharger" :aria-label="`Télécharger ${d.nomOriginal}`" @click="telechargerDocument(d)"><i class="fa-solid fa-download text-sm"></i></button>
                    </li>
                </ul>
                <p v-else class="mt-4 text-sm text-gray-400">Aucun document déposé pour cette année.</p>
                <div class="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-3 transition hover:border-insec-300 hover:bg-insec-50/30">
                    <i class="fa-solid fa-cloud-arrow-up text-insec-400"></i>
                    <input type="file" accept="application/pdf" multiple class="min-w-0 flex-1 text-xs text-gray-600" :aria-label="`Choisir ${r.titre}`" @change="choisir(r.type, $event)" />
                    <button type="button" class="bouton-secondaire" :disabled="envoi !== null || !selection[r.type].length" @click="deposer(r.type)">
                        <i v-if="envoi === r.type" class="fa-solid fa-circle-notch fa-spin"></i>
                        {{ envoi === r.type ? 'Dépôt en cours…' : 'Déposer' }}
                    </button>
                </div>
            </article>
        </div>
    </section>
</template>
