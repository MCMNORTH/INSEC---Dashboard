import { appeler } from './api';

export interface FichierGenere {
    nom: string;
    contenu: string;
    mimeType?: string;
}

const TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function enregistrer(fichier: FichierGenere): void {
    const octets = Uint8Array.from(atob(fichier.contenu), (c) => c.charCodeAt(0));
    const extension = fichier.nom.split('.').pop() ?? '';
    const blob = new Blob([octets], { type: fichier.mimeType ?? TYPES[extension] ?? 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const lien = Object.assign(document.createElement('a'), { href: url, download: fichier.nom });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Génère un fichier côté serveur (PDF, Excel, pièce) puis le télécharge dans le navigateur. */
export async function telecharger(operation: string, donnees: object): Promise<void> {
    enregistrer(await appeler<FichierGenere>(operation, donnees));
}

export function lireEnBase64(fichier: File): Promise<string> {
    return new Promise((resoudre, rejeter) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resoudre(String(lecteur.result).split(',')[1] ?? '');
        lecteur.onerror = () => rejeter(lecteur.error);
        lecteur.readAsDataURL(fichier);
    });
}
