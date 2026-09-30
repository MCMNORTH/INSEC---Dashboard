import { reactive } from 'vue';

// Message « flash » : affiché sur la page courante, ou sur la suivante si une navigation est annoncée.
export const flash = reactive({ texte: '', type: 'succes' as 'succes' | 'erreur', navigations: 0 });

export function notifier(texte: string, options: { type?: 'succes' | 'erreur'; apresNavigation?: boolean } = {}): void {
    flash.texte = texte;
    flash.type = options.type ?? 'succes';
    flash.navigations = options.apresNavigation ? 1 : 0;
}

export function apresNavigation(): void {
    if (flash.navigations > 0) flash.navigations--;
    else flash.texte = '';
}
