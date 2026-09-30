import { doc, onSnapshot, type DocumentData, type DocumentReference, type Query } from 'firebase/firestore';
import { ref, shallowRef, watchEffect, type Ref, type ShallowRef } from 'vue';
import { messageErreur } from './api';
import { db } from './firebase';

export type AvecId<T = DocumentData> = T & { id: string };

/** Abonnement temps réel à une requête Firestore ; se réabonne quand ses dépendances réactives changent. */
export function useRequete<T = DocumentData>(fabrique: () => Query | null): {
    donnees: ShallowRef<AvecId<T>[]>;
    chargement: Ref<boolean>;
    erreur: Ref<string | null>;
} {
    const donnees: ShallowRef<AvecId<T>[]> = shallowRef([]);
    const chargement = ref(true);
    const erreur = ref<string | null>(null);
    watchEffect((nettoyer) => {
        const requete = fabrique();
        if (!requete) {
            donnees.value = [];
            chargement.value = false;
            return;
        }
        chargement.value = true;
        const arreter = onSnapshot(
            requete,
            (snap) => {
                donnees.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
                chargement.value = false;
                erreur.value = null;
            },
            (e) => {
                erreur.value = messageErreur(e);
                chargement.value = false;
            },
        );
        nettoyer(arreter);
    });
    return { donnees, chargement, erreur };
}

export function useDocument<T = DocumentData>(fabrique: () => DocumentReference | string | null): {
    donnee: ShallowRef<AvecId<T> | null>;
    chargement: Ref<boolean>;
    erreur: Ref<string | null>;
} {
    const donnee: ShallowRef<AvecId<T> | null> = shallowRef(null);
    const chargement = ref(true);
    const erreur = ref<string | null>(null);
    watchEffect((nettoyer) => {
        const cible = fabrique();
        if (!cible) {
            donnee.value = null;
            chargement.value = false;
            return;
        }
        chargement.value = true;
        const reference = typeof cible === 'string' ? doc(db, cible) : cible;
        const arreter = onSnapshot(
            reference,
            (snap) => {
                donnee.value = snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null;
                chargement.value = false;
            },
            (e) => {
                erreur.value = messageErreur(e);
                chargement.value = false;
            },
        );
        nettoyer(arreter);
    });
    return { donnee, chargement, erreur };
}

export function indexer<T extends { id: string }>(liste: T[]): Map<string, T> {
    return new Map(liste.map((e) => [e.id, e]));
}
