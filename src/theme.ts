import { computed, ref, watch } from 'vue';

/** Choix d'apparence : clair, sombre ou celui du système. Mémorisé dans ce navigateur. */
export type ChoixTheme = 'clair' | 'sombre' | 'systeme';

const CLE = 'insec.theme';
const requeteSombre = window.matchMedia('(prefers-color-scheme: dark)');

function lire(): ChoixTheme {
    try {
        const valeur = localStorage.getItem(CLE);
        return valeur === 'clair' || valeur === 'sombre' ? valeur : 'systeme';
    } catch {
        return 'systeme';
    }
}

export const choixTheme = ref<ChoixTheme>(lire());
const systemeSombre = ref(requeteSombre.matches);
requeteSombre.addEventListener('change', (e) => (systemeSombre.value = e.matches));

export const modeSombre = computed(() =>
    choixTheme.value === 'sombre' || (choixTheme.value === 'systeme' && systemeSombre.value),
);

watch(modeSombre, (sombre) => {
    document.documentElement.dataset.theme = sombre ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#0d1117' : '#f6f7f9');
}, { immediate: true });

watch(choixTheme, (choix) => {
    try {
        if (choix === 'systeme') localStorage.removeItem(CLE);
        else localStorage.setItem(CLE, choix);
    } catch {
        // Préférence simplement non mémorisée.
    }
});

export function basculerTheme(): void {
    choixTheme.value = modeSombre.value ? 'clair' : 'sombre';
}
