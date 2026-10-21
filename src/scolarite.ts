import type { Resultat, Ue } from './types';

/** Crédits des UE validées pour une inscription (une UE validée plusieurs fois ne compte qu'une fois). */
export function creditsValides(inscriptionId: string, resultats: Resultat[], ue: (id: string) => Ue | undefined): number {
    const valides = new Set(resultats.filter((r) => r.inscriptionId === inscriptionId && r.valide).map((r) => r.ueId));
    return [...valides].reduce((total, id) => total + (ue(id)?.credits ?? 0), 0);
}

export function creditsInscrits(ueIds: string[], ue: (id: string) => Ue | undefined): number {
    return ueIds.reduce((total, id) => total + (ue(id)?.credits ?? 0), 0);
}
