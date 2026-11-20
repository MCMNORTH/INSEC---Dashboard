<script setup lang="ts">
import {
    COORDONNEES_PAIEMENT_VIDES, type CoordonneesPaiement, ibanFormate, numeroMobileFormate, ribDepuisIban, ROLES_COORDONNEES_PAIEMENT,
} from '@shared/domaine';
import { computed, onMounted, reactive, ref } from 'vue';
import { appeler } from '../api';
import { useFormulaire } from '../formulaire';
import { notifier } from '../notifications';
import { aRole } from '../session';

// Coordonnées imprimées dans l'encadré « Moyens de paiement » des factures.
// Tout le monde (administration, finance) les consulte ; seul le super-administrateur les modifie.
const peutModifier = aRole(...ROLES_COORDONNEES_PAIEMENT);
const { envoi, erreurs, soumettre } = useFormulaire();

const enregistrees = ref<CoordonneesPaiement>({ ...COORDONNEES_PAIEMENT_VIDES });
const saisie = reactive<Record<keyof CoordonneesPaiement, string>>({ titulaire: '', banque: '', domiciliation: '', iban: '', bic: '', bankily: '', sedad: '' });
const modifieLe = ref<string | null>(null);
const chargement = ref(true);
const erreurChargement = ref('');
const edition = ref(false);

function remplir(c: CoordonneesPaiement) {
    enregistrees.value = c;
    saisie.titulaire = c.titulaire ?? '';
    saisie.banque = c.banque ?? '';
    saisie.domiciliation = c.domiciliation ?? '';
    saisie.iban = c.iban ? ibanFormate(c.iban) : '';
    saisie.bic = c.bic ?? '';
    saisie.bankily = c.bankily ?? '';
    saisie.sedad = c.sedad ?? '';
}

onMounted(async () => {
    try {
        const r = await appeler<{ coordonnees: CoordonneesPaiement; modifieLe: string | null }>('lireCoordonneesPaiement');
        remplir(r.coordonnees);
        modifieLe.value = r.modifieLe;
    } catch {
        erreurChargement.value = 'Les coordonnées de paiement n’ont pas pu être chargées.';
    } finally {
        chargement.value = false;
    }
});

const c = computed(() => enregistrees.value);
const rib = computed(() => (c.value.iban ? ribDepuisIban(c.value.iban) : null));
const vide = computed(() => !c.value.iban && !c.value.bankily && !c.value.sedad);
const mobileCommun = computed(() => Boolean(c.value.bankily && c.value.bankily === c.value.sedad));
const dateModification = computed(() => (modifieLe.value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(modifieLe.value)) : null));

async function enregistrer() {
    const r = await soumettre(() => appeler<{ coordonnees: CoordonneesPaiement; modifieLe: string; message: string }>('modifierCoordonneesPaiement', { ...saisie }));
    if (!r) return;
    remplir(r.coordonnees);
    modifieLe.value = r.modifieLe;
    edition.value = false;
    notifier(r.message);
}

function annuler() {
    remplir(enregistrees.value);
    erreurs.value = {};
    edition.value = false;
}

const CHAMPS: { cle: keyof CoordonneesPaiement; libelle: string; aide?: string; classe?: string }[] = [
    { cle: 'titulaire', libelle: 'Titulaire du compte', aide: 'Tel qu’il figure sur le RIB.' },
    { cle: 'banque', libelle: 'Banque' },
    { cle: 'domiciliation', libelle: 'Agence (domiciliation)' },
    { cle: 'iban', libelle: 'IBAN', aide: 'Le RIB (banque, agence, compte, clé) en est tiré automatiquement.', classe: 'sm:col-span-2' },
    { cle: 'bic', libelle: 'Code SWIFT / BIC' },
    { cle: 'bankily', libelle: 'Numéro Bankily' },
    { cle: 'sedad', libelle: 'Numéro Sedad' },
];
</script>

<template>
    <section class="carte mb-6 overflow-hidden" aria-labelledby="coordonnees-paiement">
        <header class="panneau-entete">
            <div>
                <h2 id="coordonnees-paiement" class="titre-section">Moyens de paiement imprimés sur les factures</h2>
                <p class="mt-0.5 text-xs text-gray-500">
                    Virement, Bankily, Sedad et espèces au secrétariat, avec le motif à indiquer (n° de facture et nom de l’étudiant).
                    <template v-if="dateModification"> Dernière modification : {{ dateModification }}.</template>
                </p>
            </div>
            <button v-if="peutModifier && !edition && !chargement" type="button" class="bouton-secondaire" @click="edition = true">
                <i class="fa-solid fa-pen"></i>Modifier
            </button>
        </header>

        <div class="p-5 sm:p-6">
            <p v-if="chargement" class="text-sm text-gray-400">Chargement…</p>
            <p v-else-if="erreurChargement" role="alert" class="text-sm text-red-700">{{ erreurChargement }}</p>

            <form v-else-if="edition" class="grid grid-cols-1 gap-4 sm:grid-cols-2" novalidate @submit.prevent="enregistrer">
                <label v-for="champ in CHAMPS" :key="champ.cle" class="etiquette" :class="champ.classe">
                    {{ champ.libelle }}
                    <input
                        v-model="saisie[champ.cle]"
                        class="champ mt-1.5"
                        :class="{ 'font-mono tracking-wide': champ.cle === 'iban', 'ring-red-300': erreurs[champ.cle] }"
                        :inputmode="champ.cle === 'bankily' || champ.cle === 'sedad' ? 'numeric' : undefined"
                        :autocomplete="'off'"
                    />
                    <span v-if="erreurs[champ.cle]" class="mt-1 block text-xs font-normal text-red-600">{{ erreurs[champ.cle] }}</span>
                    <span v-else-if="champ.aide" class="mt-1 block text-xs font-normal text-gray-500">{{ champ.aide }}</span>
                </label>
                <p class="text-xs text-gray-500 sm:col-span-2">
                    <i class="fa-solid fa-shield-halved mr-1 text-insec-500"></i>L’IBAN est vérifié par sa clé de contrôle avant l’enregistrement. Un champ laissé vide n’est pas imprimé ; les espèces au secrétariat figurent toujours.
                </p>
                <div class="flex flex-wrap gap-2 sm:col-span-2">
                    <button class="bouton-principal" :disabled="envoi">
                        <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i>Enregistrer
                    </button>
                    <button type="button" class="bouton-fantome" :disabled="envoi" @click="annuler">Annuler</button>
                </div>
            </form>

            <template v-else>
                <p v-if="vide" class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
                    <i class="fa-solid fa-circle-info mt-0.5 text-amber-500"></i>
                    Aucune coordonnée enregistrée : les factures n’indiquent pour l’instant que le paiement en espèces au secrétariat.
                    <template v-if="!peutModifier"> Seul le super-administrateur peut les renseigner.</template>
                </p>
                <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                    <article v-if="c.iban" class="rounded-xl p-4 ring-1 ring-gray-200/80">
                        <h3 class="flex items-center gap-2 text-xs font-bold tracking-wider text-gray-500 uppercase"><i class="fa-solid fa-building-columns text-insec-500"></i>Virement bancaire</h3>
                        <dl class="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
                            <template v-if="c.titulaire"><dt class="text-gray-500">Titulaire</dt><dd class="font-semibold text-gray-900">{{ c.titulaire }}</dd></template>
                            <template v-if="c.banque || c.domiciliation"><dt class="text-gray-500">Banque</dt><dd class="text-gray-800">{{ [c.banque, c.domiciliation].filter(Boolean).join(' · ') }}</dd></template>
                            <template v-if="rib"><dt class="text-gray-500">RIB</dt><dd class="font-mono text-gray-800">{{ rib.banque }} {{ rib.agence }} {{ rib.compte }} {{ rib.cle }}</dd></template>
                            <dt class="text-gray-500">IBAN</dt><dd class="font-mono font-semibold break-all text-gray-900">{{ ibanFormate(c.iban) }}</dd>
                            <template v-if="c.bic"><dt class="text-gray-500">SWIFT</dt><dd class="font-mono text-gray-800">{{ c.bic }}</dd></template>
                        </dl>
                    </article>
                    <article class="rounded-xl p-4 ring-1 ring-gray-200/80">
                        <h3 class="flex items-center gap-2 text-xs font-bold tracking-wider text-gray-500 uppercase"><i class="fa-solid fa-mobile-screen text-insec-500"></i>Paiement mobile</h3>
                        <template v-if="mobileCommun">
                            <p class="mt-3 text-xs text-gray-500">Bankily · Sedad</p>
                            <p class="font-titre text-xl font-bold text-gray-900 tabular-nums">{{ numeroMobileFormate(c.bankily!) }}</p>
                        </template>
                        <template v-else>
                            <template v-if="c.bankily"><p class="mt-3 text-xs text-gray-500">Bankily</p><p class="font-titre text-xl font-bold text-gray-900 tabular-nums">{{ numeroMobileFormate(c.bankily) }}</p></template>
                            <template v-if="c.sedad"><p class="mt-3 text-xs text-gray-500">Sedad</p><p class="font-titre text-xl font-bold text-gray-900 tabular-nums">{{ numeroMobileFormate(c.sedad) }}</p></template>
                            <p v-if="!c.bankily && !c.sedad" class="mt-3 text-sm text-gray-400">Non renseigné</p>
                        </template>
                        <p class="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500"><i class="fa-solid fa-money-bill-wave mr-1"></i>Espèces : au secrétariat de l’INSEC, contre reçu.</p>
                    </article>
                </div>
            </template>
        </div>
    </section>
</template>
