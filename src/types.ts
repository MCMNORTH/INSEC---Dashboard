import type { Echeance, Role } from '@shared/domaine';
import type { Timestamp } from 'firebase/firestore';

export interface Formation {
    id: string;
    code: string;
    nom: string;
    libelle: string;
    dureeAnnees: number;
    niveauDiplome?: string;
    creditsTotal?: number;
    active?: boolean;
    sourceUrl?: string;
    sourceVerifieeLe?: string;
}

export interface Ue {
    id: string;
    code: string;
    libelle: string;
    credits: number;
    formationId: string;
    anneeParcours: number;
    ordre?: number;
    active?: boolean;
}

export interface Annee {
    id: string;
    libelle: string;
}

export interface Etudiant {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: string;
    derniere: { inscriptionId: string; formationId: string; anneeId: string; statut: string } | null;
    formationIds: string[];
    anneeIds: string[];
}

export interface Inscription {
    id: string;
    etudiantId: string;
    formationId: string;
    anneeId: string;
    anneeParcours: number;
    dateInscription: string;
    numeroIntec: string | null;
    statut: string;
    ueIds: string[];
    montantDu: number;
    montantRemise: number;
    noteFinanciere: string | null;
    totalVerse: number;
    echeances: Echeance[];
    ordre: number;
    creeLe?: Timestamp;
}

export interface Versement {
    id: string;
    inscriptionId: string;
    etudiantId: string;
    montant: number;
    dateVersement: string;
    statut: string;
    modePaiement: string;
    reference: string | null;
    note: string | null;
    numeroRecu: string;
}

export interface Examen {
    id: string;
    ueId: string;
    formationId: string;
    anneeId: string;
    session: string;
    dateExamen: Timestamp;
    salle: string | null;
    noteSur: number;
    seuilValidation: number;
    statut: string;
    nbConvoques: number;
    sujetsRecusLe?: string | null;
    nombreSujetsRecus?: number | null;
    salleConfirmee?: boolean;
    surveillanceConfirmee?: boolean;
    nombreCopiesRassemblees?: number | null;
    copiesEnvoyeesLe?: string | null;
    referenceEnvoiCopies?: string | null;
}

export interface Resultat {
    id: string;
    examenId: string;
    inscriptionId: string;
    etudiantId: string;
    ueId: string;
    anneeId: string;
    session: string;
    dateExamen: Timestamp;
    salle: string | null;
    noteSur: number;
    seuilValidation: number;
    statutExamen: string;
    presence: string;
    note: number | null;
    commentaire: string | null;
    valide: boolean;
    numeroConvocation: number;
    convocationEnvoiStatut?: 'En cours' | 'Envoyée' | 'Échec';
    convocationEnvoyeeLe?: Timestamp | null;
    convocationEnvoiDemarreeLe?: Timestamp | null;
}

export interface Piece {
    id: string;
    etudiantId: string;
    type: string;
    nomOriginal: string;
    mimeType: string;
    taille: number;
    statut: string;
    dateExpiration: string | null;
    note: string | null;
    creeLe?: Timestamp;
}

export interface Candidature {
    id: string;
    reference: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    dateNaissance: string | null;
    dernierDiplome: string;
    formationId: string;
    anneeId: string;
    motivation: string | null;
    statut: string;
    noteInterne: string | null;
    etudiantId: string | null;
    creeLe?: Timestamp;
}

export interface Enseignant {
    id: string;
    nom: string;
    prenom: string;
    specialite: string;
    email: string;
    telephone: string | null;
    nbUe: number;
    nbEtudiants: number;
}

export interface Affectation {
    id: string;
    enseignantId: string;
    ueId: string;
    nombreEtudiants: number;
}

export interface Utilisateur {
    id: string;
    nom: string;
    email: string;
    role: Role;
    etudiantId: string | null;
    enseignantId: string | null;
    actif: boolean;
}

export interface Alerte {
    id: string;
    cle: string;
    type: string;
    niveau: 'danger' | 'warning' | 'success' | 'info';
    titre: string;
    message: string;
    lien: string | null;
    active: boolean;
    lueLe: Timestamp | null;
    archiveeLe: Timestamp | null;
    modifieLe?: Timestamp;
}

export interface JournalEmail {
    id: string;
    destinataire: string;
    nomDestinataire: string | null;
    type: string;
    sujet: string;
    nomPieceJointe?: string;
    statut: string;
    erreur: string | null;
    creeLe?: Timestamp;
}

export interface JournalAudit {
    id: string;
    acteurId: string | null;
    acteur: string | null;
    action: string;
    modele: string | null;
    modeleId: string | null;
    description: string;
    avant: Record<string, unknown> | null;
    apres: Record<string, unknown> | null;
    adresseIp: string | null;
    operation: string | null;
    creeLe?: Timestamp;
}

export interface Sauvegarde {
    id: string;
    nom: string;
    motif: string;
    statut: string;
    integrite: boolean;
    erreur: string | null;
    bucket: string;
    nbDocuments?: number;
    creeLe?: Timestamp;
}
