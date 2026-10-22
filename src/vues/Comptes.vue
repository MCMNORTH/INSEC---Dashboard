<script setup lang="ts">
import { libelleRole } from '@shared/domaine';
import { collection, orderBy, query } from 'firebase/firestore';
import { reactive } from 'vue';
import { appeler } from '../api';
import Chargement from '../composants/Chargement.vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { useFormulaire } from '../formulaire';
import { initiales } from '../navigation';
import { notifier } from '../notifications';
import { aRole, envoyerLienReinitialisation, session } from '../session';
import type { Utilisateur } from '../types';

const { donnees: comptes, chargement, erreur } = useRequete<Utilisateur>(() => query(collection(db, 'utilisateurs'), orderBy('nom')));
const superAdmin = aRole('super_admin');

const { envoi, erreurs, soumettre } = useFormulaire();
const f = reactive({ nom: '', email: '', role: 'finance' });

/** Mot de passe aléatoire que personne ne connaît, exigé par les anciennes versions du serveur (ignoré ensuite). */
function motDePasseJetable(): string {
    const octets = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
}

async function creer() {
    const email = f.email.trim();
    const resultat = await soumettre(() =>
        appeler<{ email?: string; message: string }>('creerCompte', { ...f, email, motDePasse: motDePasseJetable() }),
    );
    if (!resultat) return;
    try {
        // E-mail officiel Firebase : le lien n'est jamais visible ni enregistré dans l'application.
        await envoyerLienReinitialisation(resultat.email ?? email);
        notifier(`Compte créé. E-mail envoyé à ${email} pour définir le mot de passe.`);
    } catch {
        notifier(`Compte créé, mais l’e-mail n’a pas pu être envoyé : demandez à la personne d’utiliser « Mot de passe oublié » avec ${email}.`);
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
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Administration</p>
            <h1 class="titre-page mt-1.5">Comptes & accès</h1>
            <p class="sous-titre">Accès de l’équipe INSEC (administration et finance)</p>
        </div>
    </header>
    <div class="grid gap-6 lg:grid-cols-3">
        <section class="carte overflow-x-auto lg:col-span-2">
            <Chargement :chargement="chargement" :erreur="erreur">
                <table class="tableau">
                    <thead><tr><th>Compte</th><th>Rôle</th><th>Statut</th></tr></thead>
                    <tbody>
                        <tr v-for="c in comptes" :key="c.id">
                            <td>
                                <div class="flex items-center gap-3">
                                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec-50 text-[11px] font-bold text-insec-700 ring-1 ring-insec-100">{{ initiales(c.nom || c.email || '') }}</span>
                                    <span class="min-w-0">
                                        <strong class="block font-semibold text-gray-900">{{ c.nom }}</strong>
                                        <span class="block text-xs text-gray-500">{{ c.email }}</span>
                                    </span>
                                </div>
                            </td>
                            <td class="text-gray-600">{{ libelleRole(c.role) }}</td>
                            <td>
                                <button
                                    :class="['pastille cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-70', c.actif ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 hover:bg-emerald-100' : 'bg-red-50 text-red-700 ring-red-600/15 hover:bg-red-100']"
                                    :disabled="envoi || !modifiable(c)"
                                    :title="c.id === session.uid ? 'Vous ne pouvez pas désactiver votre propre compte' : !modifiable(c) ? 'Réservé au super-administrateur' : c.actif ? 'Désactiver' : 'Activer'"
                                    @click="basculer(c)"
                                ><span :class="['h-1.5 w-1.5 rounded-full', c.actif ? 'bg-emerald-500' : 'bg-red-500']"></span>{{ c.actif ? 'Actif' : 'Désactivé' }}</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Chargement>
        </section>
        <aside class="carte self-start overflow-hidden">
            <header class="panneau-entete">
                <div>
                    <h2 class="titre-section">Créer un compte</h2>
                    <p class="mt-0.5 text-xs text-gray-500">Invitation par e-mail</p>
                </div>
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-insec-50 text-insec-600"><i class="fa-solid fa-user-plus text-sm"></i></span>
            </header>
            <form class="space-y-4 p-5 sm:p-6" @submit.prevent="creer">
                <label class="etiquette">Nom affiché
                    <input v-model="f.nom" class="champ mt-1.5" required />
                </label>
                <label class="etiquette">E-mail
                    <input v-model="f.email" type="email" class="champ mt-1.5" required autocomplete="off" />
                    <span v-if="erreurs.email" class="mt-1 block text-xs text-red-600">{{ erreurs.email }}</span>
                </label>
                <label class="etiquette">Rôle
                    <select v-model="f.role" class="champ mt-1.5">
                        <option value="finance">Finance</option>
                        <option v-if="superAdmin" value="admin">Administrateur</option>
                    </select>
                </label>
                <p class="rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500"><i class="fa-solid fa-circle-info mr-1 text-insec-400"></i>La personne recevra un e-mail pour choisir elle-même son mot de passe.<template v-if="!superAdmin"> Seul le super-administrateur peut créer un compte administrateur.</template></p>
                <button class="bouton-action w-full" :disabled="envoi">Créer le compte</button>
            </form>
        </aside>
    </div>
</template>
