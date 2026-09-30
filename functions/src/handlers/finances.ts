import { randomUUID } from 'node:crypto';
import { auditerModele, trace } from '../lib/audit.js';
import { operation } from '../lib/contexte.js';
import { col, exiger, nomComplet, prochainNumero } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { formaterMontant, MODES_PAIEMENT, numeroFormate, ROLES_FINANCE, STATUTS_VERSEMENT } from '../shared/domaine.js';

const formaterDate = (iso: string) => iso.split('-').reverse().join('/');

export const modifierSituationFinanciere = operation('modifierSituationFinanciere', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({ id: s.id(), montantDu: s.entier(0), montantRemise: s.entier(0), noteFinanciere: s.texteOptionnel(2000) }),
        donnees,
    );
    if (v.montantRemise > v.montantDu) erreurChamp('montantRemise', 'La remise ne peut pas dépasser le montant dû.');
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.id);
        const avant = await exiger(tx, ref, 'Inscription introuvable.');
        const apres = { montantDu: v.montantDu, montantRemise: v.montantRemise, noteFinanciere: v.noteFinanciere };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', v.id, 'updated', avant, apres);
    });
    return { message: 'Situation financière mise à jour.' };
});

export const ajouterVersement = operation('ajouterVersement', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({
            inscriptionId: s.id(),
            montant: s.entier(1),
            dateVersement: s.date(),
            statut: s.choix(STATUTS_VERSEMENT),
            modePaiement: s.choix(MODES_PAIEMENT),
            reference: s.texteOptionnel(100),
            note: s.texteOptionnel(1000),
        }),
        donnees,
    );
    const ref = col.versements().doc();
    let numeroRecu = '';
    await db.runTransaction(async (tx) => {
        const inscriptionRef = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, inscriptionRef, 'Inscription introuvable.');
        const etudiant = await exiger(tx, col.etudiants().doc(inscription.etudiantId), 'Étudiant introuvable.');
        const [numero, incrementer] = await prochainNumero(tx, 'recus');
        numeroRecu = numeroFormate('REC', numero, new Date());
        const versement = {
            inscriptionId: v.inscriptionId,
            etudiantId: inscription.etudiantId,
            montant: v.montant,
            dateVersement: v.dateVersement,
            statut: v.statut,
            modePaiement: v.modePaiement,
            reference: v.reference,
            note: v.note,
            numeroRecu,
        };
        incrementer();
        tx.set(ref, { ...versement, ...trace(acteur, true) });
        if (v.statut === 'Validée') {
            tx.update(inscriptionRef, { totalVerse: FieldValue.increment(v.montant), ...trace(acteur) });
            mettreEnFileEmail(tx, {
                destinataire: etudiant.email,
                nomDestinataire: nomComplet(etudiant),
                type: 'Paiement',
                sujet: 'Confirmation de votre paiement INSEC',
                titre: 'Paiement validé',
                message: 'Votre versement a été validé et enregistré dans votre dossier financier.',
                details: { Reçu: numeroRecu, Montant: `${formaterMontant(v.montant)} MRU`, Date: formaterDate(v.dateVersement) },
            });
        }
        auditerModele(tx, acteur, 'Versement', ref.id, 'created', null, versement);
    });
    return { id: ref.id, numeroRecu, message: 'Versement enregistré avec un numéro de reçu.' };
});

export const ajouterEcheance = operation('ajouterEcheance', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(
        z.object({ inscriptionId: s.id(), libelle: s.texte(100), montant: s.entier(1), dateEcheance: s.date() }),
        donnees,
    );
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.inscriptionId);
        const inscription = await exiger(tx, ref, 'Inscription introuvable.');
        const echeance = { id: randomUUID(), libelle: v.libelle, montant: v.montant, dateEcheance: v.dateEcheance };
        const echeances = [...(inscription.echeances ?? []), echeance].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance));
        tx.update(ref, { echeances, ...trace(acteur) });
        auditerModele(tx, acteur, 'Echeance', echeance.id, 'created', null, { inscriptionId: v.inscriptionId, ...echeance });
    });
    return { message: 'Échéance ajoutée.' };
});
