<script setup lang="ts">
import { reactive, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import { useFormulaire } from '../../formulaire';
import { useReferentiel } from '../../referentiel';

const router = useRouter();
const { formationsActives, annees } = useReferentiel();
const { envoi, erreurs, erreur, soumettre } = useFormulaire();
const formulaire = reactive({
    prenom: '', nom: '', email: '', telephone: '', dateNaissance: '', dernierDiplome: '', formationId: '', anneeId: '', motivation: '',
});
watchEffect(() => {
    if (!formulaire.anneeId && annees.value[0]) formulaire.anneeId = annees.value[0].id;
});

const champs = [
    ['prenom', 'Prénom', 'text', true], ['nom', 'Nom', 'text', true], ['email', 'Adresse e-mail', 'email', true],
    ['telephone', 'Téléphone', 'tel', true], ['dateNaissance', 'Date de naissance', 'date', false], ['dernierDiplome', 'Dernier diplôme obtenu', 'text', true],
] as const;

async function envoyer() {
    const resultat = await soumettre(() => appeler<{ reference: string }>('deposerCandidature', formulaire));
    if (resultat) await router.push(`/admission/confirmation/${resultat.reference}`);
}
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <header class="bg-insec text-white">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
                <strong class="text-xl">INSEC</strong>
                <RouterLink to="/connexion" class="rounded-lg bg-white/10 px-4 py-2 text-sm">Espace connecté</RouterLink>
            </div>
        </header>
        <main class="mx-auto max-w-3xl p-6 py-10">
            <div class="mb-7">
                <p class="text-sm font-semibold text-insec-or">DGC · DSGC — INTEC CNAM</p>
                <h1 class="mt-1 text-3xl font-bold text-insec">Demande de préinscription</h1>
                <p class="mt-2 text-gray-500">Déposez votre candidature. L’équipe INSEC étudiera votre dossier avant toute inscription définitive.</p>
            </div>
            <div v-if="erreur" role="alert" class="mb-5 rounded-lg bg-red-50 p-4 text-red-800">
                <ul class="list-disc pl-5">
                    <li v-for="(message, champ) in (Object.keys(erreurs).length ? erreurs : { _: erreur })" :key="champ">{{ message }}</li>
                </ul>
            </div>
            <form class="space-y-5 rounded-2xl border bg-white p-6 shadow-sm" @submit.prevent="envoyer">
                <div class="grid gap-4 md:grid-cols-2">
                    <label v-for="[cle, libelle, type, requis] in champs" :key="cle" class="etiquette">{{ libelle }}
                        <input v-model="formulaire[cle]" :type="type" class="champ mt-1" :required="requis" :max="type === 'date' ? new Date().toISOString().slice(0, 10) : undefined" />
                    </label>
                    <label class="etiquette">Diplôme visé
                        <select v-model="formulaire.formationId" class="champ mt-1" required>
                            <option value="">Sélectionner…</option>
                            <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.code }} — {{ f.libelle }}</option>
                        </select>
                    </label>
                    <label class="etiquette">Année académique
                        <select v-model="formulaire.anneeId" class="champ mt-1" required>
                            <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
                        </select>
                    </label>
                </div>
                <label class="etiquette">Motivation <span class="text-gray-400">(facultatif)</span>
                    <textarea v-model="formulaire.motivation" rows="4" maxlength="2000" class="champ mt-1"></textarea>
                </label>
                <label class="flex gap-2 text-sm text-gray-600">
                    <input type="checkbox" required class="mt-1 rounded border-gray-300" />
                    <span>Je certifie l’exactitude des informations transmises et autorise leur traitement pour ma demande d’admission.</span>
                </label>
                <button class="bouton-principal w-full py-3" :disabled="envoi">Envoyer ma candidature</button>
            </form>
        </main>
    </div>
</template>
