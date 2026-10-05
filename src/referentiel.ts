import { collection, onSnapshot } from 'firebase/firestore';
import { ANNEE_ACADEMIQUE_PAR_DEFAUT, ANNEES_ACADEMIQUES_VISIBLES } from '@shared/domaine';
import { computed, shallowRef } from 'vue';
import { db } from './firebase';
import { session } from './session';
import type { Annee, Formation, Ue } from './types';

// Référentiel partagé par toutes les vues (diplômes, UE, années), chargé une seule fois.
const formations = shallowRef<Formation[]>([]);
const annees = shallowRef<Annee[]>([]);
const ues = shallowRef<Ue[]>([]);
const demarres = new Set<string>();

function demarrer(nom: 'formations' | 'annees' | 'ues') {
    if (demarres.has(nom)) return;
    demarres.add(nom);
    const cible = { formations, annees, ues }[nom];
    onSnapshot(
        collection(db, nom),
        (snap) => (cible.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as never),
        () => demarres.delete(nom),
    );
}

export function useReferentiel() {
    demarrer('formations');
    demarrer('annees');
    if (session.uid) demarrer('ues');
    const formationsTriees = computed(() => [...formations.value].sort((a, b) => a.code.localeCompare(b.code)));
    const formationsActives = computed(() => formationsTriees.value.filter((f) => f.active !== false));
    const anneesTriees = computed(() => {
        const visibles = new Set<string>(ANNEES_ACADEMIQUES_VISIBLES);
        return annees.value
            .filter((a) => visibles.has(a.libelle))
            .sort((a, b) => a.libelle.localeCompare(b.libelle));
    });
    const anneeCourante = computed(
        () => anneesTriees.value.find((a) => a.libelle === ANNEE_ACADEMIQUE_PAR_DEFAUT) ?? null,
    );
    const uesTriees = computed(() => [...ues.value].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)));
    const parId = <T extends { id: string }>(liste: T[]) => new Map(liste.map((e) => [e.id, e]));
    const indexFormations = computed(() => parId(formations.value));
    const indexAnnees = computed(() => parId(annees.value));
    const indexUes = computed(() => parId(ues.value));
    return {
        formations: formationsTriees,
        formationsActives,
        annees: anneesTriees,
        anneeCourante,
        ues: uesTriees,
        formation: (id?: string | null) => (id ? indexFormations.value.get(id) : undefined),
        annee: (id?: string | null) => (id ? indexAnnees.value.get(id) : undefined),
        ue: (id?: string | null) => (id ? indexUes.value.get(id) : undefined),
    };
}
