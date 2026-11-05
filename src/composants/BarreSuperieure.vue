<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler, messageErreur } from '../api';
import { confirmer } from '../dialogue';
import { correspond, LIBELLES_ROLES, NAVIGATION } from '../navigation';
import { notifier } from '../notifications';
import { aRole, deconnexion, session } from '../session';
import { useAlertesNonLues } from './alertesNonLues';
import { choixTheme, type ChoixTheme } from '../theme';
import Avatar from './Avatar.vue';
import BoutonTheme from './BoutonTheme.vue';
import MenuDeroulant from './MenuDeroulant.vue';

defineEmits<{ menu: []; recherche: [] }>();

const route = useRoute();
const router = useRouter();
const nonLues = useAlertesNonLues();

// Fil d'Ariane : rubrique de la navigation, puis titre de la page si elle est plus profonde.
const fil = computed(() => {
    for (const groupe of NAVIGATION) {
        const entree = groupe.entrees.find((e) => correspond(route.path, e));
        if (entree) {
            const titre = route.meta.titre;
            return { groupe: groupe.titre, rubrique: entree, page: route.path !== entree.vers && titre && titre !== entree.libelle ? titre : null };
        }
    }
    return { groupe: null, rubrique: null, page: route.meta.titre ?? null };
});

const THEMES: { valeur: ChoixTheme; libelle: string; icone: string }[] = [
    { valeur: 'clair', libelle: 'Clair', icone: 'fa-sun' },
    { valeur: 'sombre', libelle: 'Sombre', icone: 'fa-moon' },
    { valeur: 'systeme', libelle: 'Système', icone: 'fa-desktop' },
];

const estMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Photo de profil : recadrée en carré et réduite à 256 px dans le navigateur avant l'envoi.
const champPhoto = ref<HTMLInputElement | null>(null);
const envoiPhoto = ref(false);
const COTE_PHOTO = 256;

async function reduirePhoto(fichier: File): Promise<string> {
    const image = await createImageBitmap(fichier);
    const cote = Math.min(image.width, image.height);
    const toile = document.createElement('canvas');
    toile.width = toile.height = COTE_PHOTO;
    const contexte = toile.getContext('2d')!;
    // Fond blanc : la transparence d'un PNG deviendrait noire en JPEG.
    contexte.fillStyle = '#fff';
    contexte.fillRect(0, 0, COTE_PHOTO, COTE_PHOTO);
    contexte.imageSmoothingQuality = 'high';
    contexte.drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, COTE_PHOTO, COTE_PHOTO);
    image.close();
    return toile.toDataURL('image/jpeg', 0.85);
}

async function enregistrerPhoto(photo: string | null) {
    envoiPhoto.value = true;
    try {
        const resultat = await appeler('modifierPhotoProfil', { photo });
        notifier(resultat.message ?? 'Photo de profil mise à jour.');
    } catch (erreur) {
        notifier(messageErreur(erreur), { type: 'erreur' });
    } finally {
        envoiPhoto.value = false;
    }
}

async function photoChoisie(evenement: Event) {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
        notifier('Choisissez une image JPEG, PNG ou WebP.', { type: 'erreur' });
        return;
    }
    if (fichier.size > 10 * 1024 * 1024) {
        notifier('Image trop lourde (10 Mo au maximum).', { type: 'erreur' });
        return;
    }
    let photo: string;
    try {
        photo = await reduirePhoto(fichier);
    } catch {
        notifier('Cette image n’a pas pu être lue.', { type: 'erreur' });
        return;
    }
    await enregistrerPhoto(photo);
}

async function retirerPhoto() {
    const ok = await confirmer({ titre: 'Retirer votre photo ?', message: 'Vos initiales s’afficheront à nouveau à la place de la photo.', libelle: 'Retirer la photo', ton: 'danger' });
    if (ok) await enregistrerPhoto(null);
}

async function quitter() {
    const ok = await confirmer({
        titre: 'Se déconnecter ?',
        message: 'Vous devrez saisir à nouveau votre e-mail et votre mot de passe pour revenir dans le tableau de bord.',
        libelle: 'Se déconnecter',
        ton: 'danger',
    });
    if (!ok) return;
    await deconnexion();
    await router.push('/connexion');
}
</script>

<template>
    <header class="sticky top-0 z-30 border-b border-gray-200/70 bg-fond/80 backdrop-blur-xl supports-[backdrop-filter]:bg-fond/70">
        <div class="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
            <!-- Sur téléphone et tablette, le menu s'ouvre depuis la barre d'onglets du bas. -->
            <button type="button" class="bouton-icone -ml-1 hidden text-gray-600" aria-label="Ouvrir le menu" @click="$emit('menu')">
                <i class="fa-solid fa-bars-staggered text-lg"></i>
            </button>

            <nav aria-label="Fil d’Ariane" class="flex min-w-0 items-center gap-2 text-sm max-sm:text-[15px]">
                <RouterLink v-if="fil.page && fil.rubrique" :to="fil.rubrique.vers" class="bouton-icone -ml-2 shrink-0 text-gray-600 sm:hidden" :aria-label="`Retour : ${fil.rubrique.libelle}`">
                    <i class="fa-solid fa-chevron-left"></i>
                </RouterLink>
                <span v-if="fil.groupe" class="hidden text-gray-400 sm:inline">{{ fil.groupe }}</span>
                <span v-if="fil.groupe" class="hidden sm:inline"><i class="fa-solid fa-chevron-right text-[9px] text-gray-300"></i></span>
                <RouterLink
                    v-if="fil.rubrique"
                    :to="fil.rubrique.vers"
                    :class="['flex min-w-0 items-center gap-2 truncate font-semibold transition', fil.page ? 'text-gray-500 hover:text-gray-900 max-sm:hidden' : 'text-gray-900']"
                >
                    <i :class="['fa-solid text-[13px] text-insec-500', fil.rubrique.icone]"></i>
                    <span class="truncate">{{ fil.rubrique.libelle }}</span>
                </RouterLink>
                <template v-if="fil.page">
                    <span class="contents max-sm:hidden"><i class="fa-solid fa-chevron-right text-[9px] text-gray-300"></i></span>
                    <span class="truncate font-semibold text-gray-900">{{ fil.page }}</span>
                </template>
            </nav>

            <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
                <button
                    type="button"
                    class="group hidden h-10 w-64 cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-surface/80 px-3 text-sm text-gray-400 shadow-xs transition hover:border-gray-300 hover:text-gray-600 lg:flex xl:w-80"
                    @click="$emit('recherche')"
                >
                    <i class="fa-solid fa-magnifying-glass text-[13px]"></i>
                    <span class="flex-1 text-left">Rechercher…</span>
                    <kbd class="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-gray-500">{{ estMac ? '⌘' : 'Ctrl' }} K</kbd>
                </button>
                <button type="button" class="bouton-icone lg:hidden" aria-label="Rechercher" @click="$emit('recherche')">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </button>

                <!-- Sur téléphone, l'apparence se règle dans le menu du compte. -->
                <BoutonTheme class="max-sm:hidden" />

                <RouterLink to="/alertes" class="bouton-icone relative h-10 w-10" :aria-label="nonLues ? `${nonLues} alerte(s) non lue(s)` : 'Alertes'">
                    <i class="fa-regular fa-bell text-[17px]"></i>
                    <span v-if="nonLues" class="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e01a2e] px-1 text-[9.5px] font-bold text-white ring-2 ring-fond">
                        {{ nonLues > 9 ? '9+' : nonLues }}
                    </span>
                </RouterLink>

                <div class="mx-1 hidden h-6 w-px bg-gray-200 sm:block"></div>

                <MenuDeroulant libelle="Menu du compte" largeur="w-72" classe-declencheur="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition hover:bg-surface">
                    <template #declencheur="{ ouvert }">
                        <Avatar :nom="session.nom" :photo="session.photo" classe="h-8 w-8 text-[11px] ring-2 ring-surface" />
                        <span class="hidden min-w-0 text-left sm:block">
                            <span class="block max-w-36 truncate text-[13px] leading-4 font-semibold text-gray-900">{{ session.nom }}</span>
                            <span class="block text-[11px] leading-4 text-gray-500">{{ LIBELLES_ROLES[session.role ?? ''] ?? 'Équipe INSEC' }}</span>
                        </span>
                        <span class="hidden sm:block"><i :class="['fa-solid fa-chevron-down text-[10px] text-gray-400 transition', ouvert && 'rotate-180']"></i></span>
                    </template>

                    <div class="flex items-center gap-3 rounded-xl bg-linear-to-br from-insec-50 to-surface p-3 ring-1 ring-insec-100">
                        <Avatar :nom="session.nom" :photo="session.photo" classe="h-10 w-10 text-xs" />
                        <span class="min-w-0">
                            <span class="block truncate text-sm font-semibold text-gray-900">{{ session.nom }}</span>
                            <span class="block truncate text-xs text-gray-500">{{ session.email }}</span>
                        </span>
                    </div>
                    <div class="my-1.5 h-px bg-gray-100"></div>
                    <button role="menuitem" type="button" class="element-menu" :disabled="envoiPhoto" @click="champPhoto?.click()">
                        <i :class="['fa-solid', envoiPhoto ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ session.photo ? 'Changer ma photo' : 'Ajouter une photo' }}
                    </button>
                    <button v-if="session.photo" role="menuitem" type="button" class="element-menu" :disabled="envoiPhoto" @click="retirerPhoto">
                        <i class="fa-solid fa-user-xmark"></i>Retirer ma photo
                    </button>
                    <div class="my-1.5 h-px bg-gray-100"></div>
                    <RouterLink v-if="aRole('admin', 'super_admin')" role="menuitem" to="/tableau-de-bord" class="element-menu"><i class="fa-solid fa-chart-simple"></i>Tableau de bord</RouterLink>
                    <RouterLink v-if="aRole('admin', 'super_admin')" role="menuitem" to="/gestion" class="element-menu"><i class="fa-solid fa-sliders"></i>Centre de gestion</RouterLink>
                    <RouterLink role="menuitem" to="/alertes" class="element-menu">
                        <i class="fa-solid fa-bell"></i>Alertes
                        <span v-if="nonLues" class="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{{ nonLues }}</span>
                    </RouterLink>
                    <button role="menuitem" type="button" class="element-menu" @click="$emit('recherche')">
                        <i class="fa-solid fa-magnifying-glass"></i>Recherche rapide
                        <kbd class="ml-auto font-sans text-[11px] text-gray-400">{{ estMac ? '⌘' : 'Ctrl' }} K</kbd>
                    </button>
                    <div class="my-1.5 h-px bg-gray-100"></div>
                    <div class="px-3 pt-1 pb-2" @click.stop>
                        <p class="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-gray-400 uppercase">Apparence</p>
                        <div class="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Apparence">
                            <button
                                v-for="t in THEMES"
                                :key="t.valeur"
                                type="button"
                                role="radio"
                                :aria-checked="choixTheme === t.valeur"
                                :class="[
                                    'flex cursor-pointer flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition',
                                    choixTheme === t.valeur ? 'bg-surface text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800',
                                ]"
                                @click="choixTheme = t.valeur"
                            >
                                <i :class="['fa-solid text-xs', t.icone]"></i>{{ t.libelle }}
                            </button>
                        </div>
                    </div>
                    <div class="my-1.5 h-px bg-gray-100"></div>
                    <button role="menuitem" type="button" class="element-menu danger" @click="quitter">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i>Se déconnecter
                    </button>
                </MenuDeroulant>
                <!-- Hors du menu : le champ reste monté quand le menu se ferme pendant le choix du fichier. -->
                <input ref="champPhoto" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="photoChoisie" />
            </div>
        </div>
    </header>
</template>

<style scoped>
@reference '../style.css';

.element-menu {
    @apply flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-gray-700 transition outline-none hover:bg-gray-50 hover:text-gray-900 focus:bg-gray-50;
}
.element-menu > i:first-child {
    @apply w-4 text-center text-[13px] text-gray-400;
}
.element-menu.router-link-active > i:first-child {
    @apply text-insec-500;
}
.element-menu.danger,
.element-menu.danger > i:first-child {
    @apply text-red-600 hover:bg-red-50 focus:bg-red-50;
}
</style>
