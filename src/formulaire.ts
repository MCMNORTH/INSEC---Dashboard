import { ref } from 'vue';
import { ErreurApi, messageErreur } from './api';
import { notifier } from './notifications';

/** État d'envoi et erreurs de validation (par champ) d'un formulaire relié à une opération serveur. */
export function useFormulaire() {
    const envoi = ref(false);
    const erreurs = ref<Record<string, string>>({});
    const erreur = ref('');

    async function soumettre<T>(action: () => Promise<T>): Promise<T | undefined> {
        if (envoi.value) return undefined;
        envoi.value = true;
        erreurs.value = {};
        erreur.value = '';
        try {
            return await action();
        } catch (e) {
            erreur.value = messageErreur(e);
            if (e instanceof ErreurApi) erreurs.value = e.champs;
            notifier(erreur.value, { type: 'erreur' });
            return undefined;
        } finally {
            envoi.value = false;
        }
    }

    return { envoi, erreurs, erreur, soumettre };
}
