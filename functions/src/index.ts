import './lib/firebase.js';

export { synchroniserAlertes } from './handlers/alertes.js';
export { confirmationCandidature, convertirCandidature, deciderCandidature, deposerCandidature } from './handlers/candidatures.js';
export { basculerCompte, creerCompte } from './handlers/comptes.js';
export { enregistrerPiece, modifierPiece, telechargerPiece } from './handlers/documents.js';
export { envoyerEmail } from './handlers/emails.js';
export { affecterUe, creerEnseignant, modifierEnseignant, retirerAffectation, supprimerEnseignant } from './handlers/enseignants.js';
export { creerEtudiant, creerInscription, modifierEtudiant, modifierInscription, supprimerEtudiant } from './handlers/etudiants.js';
export { exporterExcel, importerEtudiants } from './handlers/excel.js';
export { creerExamen, enregistrerPresencesExamen, enregistrerResultat, mettreAJourPreparationExamen } from './handlers/examens.js';
export { ajouterEcheance, ajouterVersement, modifierSituationFinanciere } from './handlers/finances.js';
export { envoyerConvocationsExamen, envoyerDocumentParEmail, genererPdf } from './handlers/pdf.js';
export { sante } from './handlers/sante.js';
export { creerSauvegarde, restaurerSauvegarde, sauvegardeQuotidienne, verifierSauvegarde } from './handlers/sauvegardes.js';
export { tableauDeBordAdmin } from './handlers/tableauDeBord.js';
