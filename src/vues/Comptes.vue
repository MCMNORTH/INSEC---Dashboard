<script setup lang="ts">
import { libelleRole } from '@shared/domaine';
import { collection, orderBy, query } from 'firebase/firestore';
import { reactive } from 'vue';
import { appeler } from '../api';
import Chargement from '../composants/Chargement.vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { useFormulaire } from '../formulaire';
import { notifier } from '../notifications';
import { aRole, envoyerLienReinitialisation, session } from '../session';
import type { Utilisateur } from '../types';

const { donnees: comptes, chargement, erreur } = useRequete<Utilisateur>(() => query(collection(db, 'utilisateurs'), orderBy('nom')));
const superAdmin = aRole('super_admin');

const { envoi, erreurs, soumettre } = useFormulaire();
const f = reactive({ nom: '', email: '', role: 'finance' });

async function creer() {
    const resultat = await soumettre(() => appeler<{ email: string; message: string }>('creerCompte', { ...f }));
    if (!resultat) return;
    try {
        // E-mail officiel Firebase : le lien n'est jamais visible ni enregistré dans l'application.
        await envoyerLienReinitialisation(resultat.email);
        notifier(`${resultat.message} E-mail envoyé à ${resultat.email}.`);
    } catch {
        notifier(`Compte créé, mais l’e-mail n’a pas pu être envoyé : demandez à la personne d’utiliser « Mot de passe oublié » avec ${resultat.email}.`);
    }
    Object.assign(f, { nom: '', email: '', role: 'finance' });
}

/** Un administrateur ne peut gérer que les comptes finance ; le super-administrateur gère aussi les administrateurs. */
const modifiable = (c: Utilisateur) => c.id !== session.uid && (superAdmin || (c.role !== 'admin' && c.role !== 'super_admin'));

async function basculer(c: Utilisateur) {
    const resultat = await soumettre(() => appeler('basculerCompte', { uid: c.id }));
    if (resultat) notifier(resultat.message ?? 'Compte mis à jour.');
}
</script>

<template>
    <h1 class="text-xl font-bold text-insec">Comptes & accès</h1>
    <p class="mb-5 text-gray-500">Accès de l’équipe INSEC (administration et finance)</p>
    <div class="grid gap-5 lg:grid-cols-3">
        <section class="overflow-x-auto rounded-xl bg-white shadow lg:col-span-2">
            <Chargement :chargement="chargement" :erreur="erreur">
                <table class="tableau">
                    <thead><tr><th>Compte</th><th>Rôle</th><th>Statut</th></tr></thead>
                    <tbody>
                        <tr v-for="c in comptes" :key="c.id">
                            <td><strong>{{ c.nom }}</strong><br /><span class="text-gray-500">{{ c.email }}</span></td>
                            <td>{{ libelleRole(c.role) }}</td>
                            <td>
                                <button
                                    :class="['cursor-pointer rounded px-2 py-1 disabled:cursor-not-allowed', c.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']"
                                    :disabled="envoi || !modifiable(c)"
                                    :title="c.id === session.uid ? 'Vous ne pouvez pas désactiver votre propre compte' : !modifiable(c) ? 'Réservé au super-administrateur' : c.actif ? 'Désactiver' : 'Activer'"
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
                    <option value="finance">Finance</option>
                    <option v-if="superAdmin" value="admin">Administrateur</option>
                </select>
                <p class="text-xs text-gray-500">La personne recevra un e-mail pour choisir elle-même son mot de passe.<template v-if="!superAdmin"> Seul le super-administrateur peut créer un compte administrateur.</template></p>
                <button class="bouton-action w-full" :disabled="envoi">Créer le compte</button>
            </form>
        </aside>
    </div>
</template>
