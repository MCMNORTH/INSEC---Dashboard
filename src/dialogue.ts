import { reactive } from 'vue';

// Fenêtre de confirmation du site, à la place de window.confirm / window.prompt.
// Une seule fenêtre à la fois, affichée par le composant Dialogue (monté dans App.vue).

export type TonDialogue = 'action' | 'danger' | 'envoi';

export interface OptionsDialogue {
    titre: string;
    message?: string;
    /** Récapitulatif affiché sous forme de lignes « libellé : valeur » (montant, date, destinataire…). */
    details?: Record<string, string>;
    /** Libellé du bouton de confirmation (« Confirmer » par défaut). */
    libelle?: string;
    ton?: TonDialogue;
}

export interface OptionsMotif extends OptionsDialogue {
    /** Libellé du champ de saisie (obligatoire pour confirmer). */
    champ: string;
    indication?: string;
}

export const dialogue = reactive({
    ouvert: false,
    options: { titre: '' } as OptionsDialogue & Partial<OptionsMotif>,
    saisie: '',
    resoudre: null as ((valeur: string | null) => void) | null,
});

function ouvrir(options: OptionsDialogue & Partial<OptionsMotif>): Promise<string | null> {
    // Une demande encore ouverte est considérée comme annulée.
    dialogue.resoudre?.(null);
    return new Promise((resoudre) => {
        Object.assign(dialogue, { ouvert: true, options, saisie: '', resoudre });
    });
}

export function fermerDialogue(valeur: string | null): void {
    const resoudre = dialogue.resoudre;
    Object.assign(dialogue, { ouvert: false, resoudre: null });
    resoudre?.(valeur);
}

/** Demande une confirmation ; renvoie true si l'utilisateur confirme. */
export async function confirmer(options: OptionsDialogue): Promise<boolean> {
    return (await ouvrir(options)) !== null;
}

/** Demande une confirmation avec un motif obligatoire ; renvoie le motif saisi, ou null si annulé. */
export async function demanderMotif(options: OptionsMotif): Promise<string | null> {
    const motif = await ouvrir(options);
    return motif?.trim() || null;
}
