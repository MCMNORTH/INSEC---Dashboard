import { collection, query, where } from 'firebase/firestore';
import { computed } from 'vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { session } from '../session';

export function useAlertesNonLues() {
    const { donnees } = useRequete(() =>
        session.uid
            ? query(collection(db, 'utilisateurs', session.uid, 'alertes'), where('active', '==', true), where('lueLe', '==', null), where('archiveeLe', '==', null))
            : null,
    );
    return computed(() => donnees.value.length);
}
