import './lib/firebase.js';

export { synchroniserAlertes } from './handlers/alertes.js';
export { lireCalendriersIntec, importerCalendrierIntec } from './handlers/calendriersIntec.js';
export { basculerCompte, creerCompte } from './handlers/comptes.js';
export {
    enregistrerDocumentFinancier, enregistrerPiece, lireDocumentsFinanciers, modifierPiece, telechargerConventionIntec,
    telechargerDocumentFinancier, telechargerPiece,
} from './handlers/documents.js';
export { envoyerEmail } from './handlers/emails.js';
export { creerEtudiant, creerInscription, modifierEtudiant, modifierInscription, supprimerEtudiant } from './handlers/etudiants.js';
export { exporterExcel, importerEtudiants } from './handlers/excel.js';
export { creerExamen, enregistrerPresencesExamen, enregistrerResultat, mettreAJourPreparationExamen } from './handlers/examens.js';
export {
    ajouterEcheance, ajouterVersement, annulerVersement, confirmerReglementBumex2024, genererEcheancier, lireTauxEuroMru, modifierEcheance,
    modifierSituationFinanciere, modifierTauxEuroMru, supprimerEcheance, traiterVersement,
} from './handlers/finances.js';
export { relancerPaiement, relancerTousLesRetards } from './handlers/relances.js';
export { analyserResultatsHistoriques, importerResultatsHistoriques, telechargerClasseurResultatsHistoriques } from './handlers/resultatsHistoriques.js';
export { envoyerConvocationsExamen, envoyerDocumentParEmail, genererPdf } from './handlers/pdf.js';
export { sante } from './handlers/sante.js';
export { creerSauvegarde, restaurerSauvegarde, sauvegardeQuotidienne, verifierSauvegarde } from './handlers/sauvegardes.js';
export { tableauDeBordAdmin } from './handlers/tableauDeBord.js';
