<script setup lang="ts">
import { libelleRole } from '@shared/domaine';
import { collection, orderBy, query } from 'firebase/firestore';
import { computed, reactive } from 'vue';
import { appeler } from '../api';
import Chargement from '../composants/Chargement.vue';
import { indexer, useRequete } from '../donnees';
import { db } from '../firebase';
import { useFormulaire } from '../formulaire';
import { notifier } from '../notifications';
import { session } from '../session';
import type { Enseignant, Etudiant, Utilisateur } from '../types';

const { donnees: comptes, chargement, erreur } = useRequete<Utilisateur>(() => query(collection(db, 'utilisateurs'), orderBy('nom')));
const { donnees: etudiants } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const { donnees: enseignants } = useRequete<Enseignant>(() => query(collection(db, 'enseignants'), orderBy('nom')));
const parEtudiant = computed(() => indexer(etudiants.value));
const parEnseignant = computed(() => indexer(enseignants.value));
const etudiantsLibres = computed(() => etudiants.value.filter((e) => !comptes.value.some((c) => c.etudiantId === e.id)));
const enseignantsLibres = computed(() => enseignants.value.filter((e) => !comptes.value.some((c) => c.enseignantId === e.id)));

const dossier = (c: Utilisateur) => {
    const lie = c.etudiantId ? parEtudiant.value.get(c.etudiantId) : c.enseignantId ? parEnseignant.value.get(c.enseignantId) : null;
    return lie ? `${lie.prenom} ${lie.nom}` : '—';
};

const { envoi, erreurs, soumettre } = useFormulaire();
const f = reactive({ nom: '', email: '', role: 'etudiant', etudiantId: '', enseignantId: '', motDePasse: '', confirmation: '' });

async function creer() {
    if (f.motDePasse !== f.confirmation) {
        erreurs.value = { motDePasse: 'La confirmation du mot de passe ne correspond pas.' };
        return;
    }
    const { confirmation: _, ...donnees } = f;
    const resultat = await soumettre(() => appeler('creerCompte', donnees));
    if (!resultat) return;
    notifier(resultat.message ?? 'Compte utilisateur créé.');
    Object.assign(f, { nom: '', email: '', etudiantId: '', enseignantId: '', motDePasse: '', confirmation: '' });
}

async function basculer(c: Utilisateur) {
    const resultat = await soumettre(() => appeler('basculerCompte', { uid: c.id }));
    if (resultat) notifier(resultat.message ?? 'Compte mis à jour.');
}
</script>

<template>
    <h1 class="text-xl font-bold text-insec">Comptes & accès</h1>
    <p class="mb-5 text-gray-500">Création des accès et rattachement aux dossiers</p>
    <div class="grid gap-5 lg:grid-cols-3">
        <section class="overflow-x-auto rounded-xl bg-white shadow lg:col-span-2">
            <Chargement :chargement="chargement" :erreur="erreur">
                <table class="tableau">
                    <thead><tr><th>Compte</th><th>Rôle</th><th>Dossier lié</th><th>Statut</th></tr></thead>
                    <tbody>
                        <tr v-for="c in comptes" :key="c.id">
                            <td><strong>{{ c.nom }}</strong><br /><span class="text-gray-500">{{ c.email }}</span></td>
                            <td>{{ libelleRole(c.role) }}</td>
                            <td>{{ dossier(c) }}</td>
                            <td>
                                <button
                                    :class="['cursor-pointer rounded px-2 py-1 disabled:cursor-not-allowed', c.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']"
                                    :disabled="envoi || c.id === session.uid"
                                    :title="c.id === session.uid ? 'Vous ne pouvez pas désactiver votre propre compte' : c.actif ? 'Désactiver' : 'Activer'"
                                    @click="basculer(c)"
                                >{{ c.actif ? 'Actif' : 'Désactivé' }}</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Chargement>
        </section>
        <aside class="carte p-5">
            <h2 class="mb-3 font-bold text-insec">Créer un compte</h2>
            <form class="space-y-3" @submit.prevent="creer">
                <input v-model="f.nom" placeholder="Nom affiché" class="champ" required aria-label="Nom affiché" />
                <input v-model="f.email" type="email" placeholder="E-mail" class="champ" required aria-label="E-mail" autocomplete="off" />
                <p v-if="erreurs.email" class="text-xs text-red-600">{{ erreurs.email }}</p>
                <select v-model="f.role" class="champ" aria-label="Rôle">
                    <option value="etudiant">Étudiant</option>
                    <option value="enseignant">Enseignant</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Administrateur</option>
                </select>
                <select v-if="f.role === 'etudiant'" v-model="f.etudiantId" class="champ" aria-label="Dossier étudiant">
                    <option value="">Dossier étudiant…</option>
                    <option v-for="e in etudiantsLibres" :key="e.id" :value="e.id">{{ e.prenom }} {{ e.nom }} · {{ e.email }}</option>
                </select>
                <p v-if="erreurs.etudiantId" class="text-xs text-red-600">{{ erreurs.etudiantId }}</p>
                <select v-if="f.role === 'enseignant'" v-model="f.enseignantId" class="champ" aria-label="Dossier enseignant">
                    <option value="">Dossier enseignant…</option>
                    <option v-for="e in enseignantsLibres" :key="e.id" :value="e.id">{{ e.prenom }} {{ e.nom }} · {{ e.email }}</option>
                </select>
                <p v-if="erreurs.enseignantId" class="text-xs text-red-600">{{ erreurs.enseignantId }}</p>
                <input v-model="f.motDePasse" type="password" placeholder="Mot de passe (8 caractères min.)" class="champ" minlength="8" required autocomplete="new-password" aria-label="Mot de passe" />
                <input v-model="f.confirmation" type="password" placeholder="Confirmer le mot de passe" class="champ" required autocomplete="new-password" aria-label="Confirmation" />
                <p v-if="erreurs.motDePasse" class="text-xs text-red-600">{{ erreurs.motDePasse }}</p>
                <button class="bouton-action w-full" :disabled="envoi">Créer le compte</button>
            </form>
        </aside>
    </div>
</template>
