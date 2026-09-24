/**
 * Schéma PostgreSQL de l'INSEC Dashboard.
 *
 * Les noms de tables et de colonnes reprennent ceux de l'ancienne application
 * Laravel afin de faciliter la migration des données (voir scripts/import-laravel.ts).
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());
const note = (name: string) => numeric(name, { precision: 5, scale: 2, mode: "number" });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/* ------------------------------------------------------------------ */
/* Comptes et sécurité                                                 */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 30 }).notNull().default("enseignant"),
  etudiantId: integer("etudiant_id")
    .unique()
    .references(() => etudiants.id, { onDelete: "set null" }),
  enseignantId: integer("enseignant_id")
    .unique()
    .references(() => enseignants.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  /** Incrémenté à chaque changement de mot de passe : invalide les sessions ouvertes. */
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passwordResetCodes = pgTable("password_reset_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  attempts: smallint("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  key: varchar("key", { length: 320 }).primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Référentiel académique                                              */
/* ------------------------------------------------------------------ */

export const formations = pgTable("formations", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).unique(),
  nom: varchar("nom", { length: 255 }).notNull(),
  libelle: varchar("libelle", { length: 255 }),
  dureeAnnees: smallint("duree_annees").notNull().default(1),
  niveauDiplome: varchar("niveau_diplome", { length: 255 }),
  creditsTotal: smallint("credits_total").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sourceUrl: varchar("source_url", { length: 500 }),
  sourceVerifieeLe: date("source_verifiee_le"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const anneesAcademiques = pgTable("annees_academiques", {
  id: serial("id").primaryKey(),
  libelle: varchar("libelle", { length: 255 }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ues = pgTable(
  "ues",
  {
    id: serial("id").primaryKey(),
    formationId: integer("formation_id").references(() => formations.id, { onDelete: "set null" }),
    code: varchar("code", { length: 255 }).notNull(),
    libelle: varchar("libelle", { length: 255 }).notNull(),
    credits: smallint("credits").notNull().default(0),
    anneeParcours: smallint("annee_parcours"),
    ordre: smallint("ordre").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ues_formation_annee_idx").on(t.formationId, t.anneeParcours)],
);

/* ------------------------------------------------------------------ */
/* Étudiants, inscriptions, finances                                   */
/* ------------------------------------------------------------------ */

export const etudiants = pgTable("etudiants", {
  id: serial("id_etudiant").primaryKey(),
  nom: varchar("nom", { length: 255 }).notNull(),
  prenom: varchar("prenom", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  telephone: varchar("telephone", { length: 255 }),
  statutEtudiant: varchar("statut_etudiant", { length: 20 }).notNull().default("Actif"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inscriptions = pgTable(
  "inscriptions",
  {
    id: serial("id").primaryKey(),
    idEtudiant: integer("id_etudiant")
      .notNull()
      .references(() => etudiants.id, { onDelete: "cascade" }),
    idFormation: integer("id_formation")
      .notNull()
      .references(() => formations.id, { onDelete: "cascade" }),
    idAnneeAcademique: integer("id_annee_academique")
      .notNull()
      .references(() => anneesAcademiques.id, { onDelete: "cascade" }),
    anneeParcours: smallint("annee_parcours"),
    dateInscription: date("date_inscription"),
    numeroInscriptionIntec: varchar("numero_inscription_intec", { length: 255 }),
    statut: varchar("statut", { length: 20 }).notNull().default("active"),
    montantDu: integer("montant_du").notNull().default(0),
    montantRemise: integer("montant_remise").notNull().default(0),
    noteFinanciere: text("note_financiere"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("inscriptions_etudiant_statut_idx").on(t.idEtudiant, t.statut)],
);

export const inscriptionUe = pgTable(
  "inscription_ue",
  {
    id: serial("id").primaryKey(),
    inscriptionId: integer("inscription_id")
      .notNull()
      .references(() => inscriptions.id, { onDelete: "cascade" }),
    ueId: integer("ue_id")
      .notNull()
      .references(() => ues.id, { onDelete: "restrict" }),
    statut: varchar("statut", { length: 20 }).notNull().default("inscrite"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("inscription_ue_unique").on(t.inscriptionId, t.ueId)],
);

export const versements = pgTable("versements", {
  id: serial("id").primaryKey(),
  inscriptionId: integer("inscription_id")
    .notNull()
    .references(() => inscriptions.id, { onDelete: "cascade" }),
  montant: integer("montant").notNull(),
  modePaiement: varchar("mode_paiement", { length: 30 }).notNull().default("Espèces"),
  reference: varchar("reference", { length: 255 }),
  numeroRecu: varchar("numero_recu", { length: 255 }).unique(),
  dateVersement: date("date_versement").notNull(),
  statut: varchar("statut", { length: 20 }).notNull().default("En attente"),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const echeances = pgTable("echeances", {
  id: serial("id").primaryKey(),
  inscriptionId: integer("inscription_id")
    .notNull()
    .references(() => inscriptions.id, { onDelete: "cascade" }),
  libelle: varchar("libelle", { length: 255 }).notNull(),
  montant: integer("montant").notNull(),
  dateEcheance: date("date_echeance").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Enseignants                                                         */
/* ------------------------------------------------------------------ */

export const enseignants = pgTable("enseignants", {
  id: serial("id").primaryKey(),
  nom: varchar("nom", { length: 255 }).notNull(),
  prenom: varchar("prenom", { length: 255 }).notNull(),
  specialite: varchar("specialite", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  telephone: varchar("telephone", { length: 255 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const affectationEnseignant = pgTable(
  "affectation_enseignant",
  {
    id: serial("id").primaryKey(),
    enseignantId: integer("enseignant_id")
      .notNull()
      .references(() => enseignants.id, { onDelete: "cascade" }),
    ueId: integer("ue_id")
      .notNull()
      .references(() => ues.id, { onDelete: "cascade" }),
    nombreEtudiants: integer("nombre_etudiants").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("affectation_enseignant_unique").on(t.enseignantId, t.ueId)],
);

/* ------------------------------------------------------------------ */
/* Examens                                                             */
/* ------------------------------------------------------------------ */

export const examens = pgTable("examens", {
  id: serial("id").primaryKey(),
  ueId: integer("ue_id")
    .notNull()
    .references(() => ues.id, { onDelete: "restrict" }),
  anneeAcademiqueId: integer("annee_academique_id")
    .notNull()
    .references(() => anneesAcademiques.id, { onDelete: "restrict" }),
  session: varchar("session", { length: 20 }).notNull().default("Normale"),
  dateExamen: timestamp("date_examen", { withTimezone: true }).notNull(),
  salle: varchar("salle", { length: 255 }),
  noteSur: note("note_sur").notNull().default(20),
  seuilValidation: note("seuil_validation").notNull().default(10),
  statut: varchar("statut", { length: 20 }).notNull().default("Planifié"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const resultatsExamens = pgTable(
  "resultats_examens",
  {
    id: serial("id").primaryKey(),
    examenId: integer("examen_id")
      .notNull()
      .references(() => examens.id, { onDelete: "cascade" }),
    inscriptionId: integer("inscription_id")
      .notNull()
      .references(() => inscriptions.id, { onDelete: "cascade" }),
    presence: varchar("presence", { length: 20 }).notNull().default("Convoqué"),
    note: note("note"),
    commentaire: text("commentaire"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("resultats_examens_unique").on(t.examenId, t.inscriptionId)],
);

/* ------------------------------------------------------------------ */
/* Documents, admissions, communications, alertes, audit               */
/* ------------------------------------------------------------------ */

export const piecesAdministratives = pgTable("pieces_administratives", {
  id: serial("id").primaryKey(),
  etudiantId: integer("etudiant_id")
    .notNull()
    .references(() => etudiants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 100 }).notNull(),
  nomOriginal: varchar("nom_original", { length: 255 }).notNull(),
  chemin: varchar("chemin", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  taille: bigint("taille", { mode: "number" }).notNull(),
  statut: varchar("statut", { length: 20 }).notNull().default("À vérifier"),
  dateExpiration: date("date_expiration"),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const candidatures = pgTable(
  "candidatures",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),
    nom: varchar("nom", { length: 255 }).notNull(),
    prenom: varchar("prenom", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    telephone: varchar("telephone", { length: 255 }).notNull(),
    dateNaissance: date("date_naissance"),
    dernierDiplome: varchar("dernier_diplome", { length: 255 }).notNull(),
    formationId: integer("formation_id")
      .notNull()
      .references(() => formations.id, { onDelete: "restrict" }),
    anneeAcademiqueId: integer("annee_academique_id")
      .notNull()
      .references(() => anneesAcademiques.id, { onDelete: "restrict" }),
    motivation: text("motivation"),
    statut: varchar("statut", { length: 20 }).notNull().default("Nouvelle"),
    noteInterne: text("note_interne"),
    etudiantId: integer("etudiant_id").references(() => etudiants.id, { onDelete: "set null" }),
    traiteeAt: timestamp("traitee_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("candidatures_email_annee_unique").on(t.email, t.anneeAcademiqueId),
    index("candidatures_statut_created_idx").on(t.statut, t.createdAt),
  ],
);

export const journalEmails = pgTable(
  "journal_emails",
  {
    id: serial("id").primaryKey(),
    destinataire: varchar("destinataire", { length: 255 }).notNull(),
    nomDestinataire: varchar("nom_destinataire", { length: 255 }),
    type: varchar("type", { length: 50 }).notNull(),
    sujet: varchar("sujet", { length: 255 }).notNull(),
    statut: varchar("statut", { length: 20 }).notNull().default("En attente"),
    erreur: text("erreur"),
    envoyeAt: timestamp("envoye_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("journal_emails_type_statut_idx").on(t.type, t.statut, t.createdAt)],
);

export const alertes = pgTable(
  "alertes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cle: varchar("cle", { length: 255 }).notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    niveau: varchar("niveau", { length: 20 }).notNull().default("info"),
    titre: varchar("titre", { length: 255 }).notNull(),
    message: text("message").notNull(),
    lien: varchar("lien", { length: 500 }),
    active: boolean("active").notNull().default(true),
    lueAt: timestamp("lue_at", { withTimezone: true }),
    archiveeAt: timestamp("archivee_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("alertes_user_cle_unique").on(t.userId, t.cle),
    index("alertes_user_active_idx").on(t.userId, t.active, t.lueAt),
  ],
);

export const journalAudit = pgTable(
  "journal_audit",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    acteur: varchar("acteur", { length: 255 }),
    action: varchar("action", { length: 50 }).notNull(),
    modele: varchar("modele", { length: 100 }),
    modeleId: varchar("modele_id", { length: 100 }),
    description: varchar("description", { length: 500 }).notNull(),
    avant: jsonb("avant").$type<Record<string, unknown> | null>(),
    apres: jsonb("apres").$type<Record<string, unknown> | null>(),
    adresseIp: varchar("adresse_ip", { length: 45 }),
    userAgent: text("user_agent"),
    route: varchar("route", { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("journal_audit_action_idx").on(t.action, t.modele, t.createdAt),
    index("journal_audit_user_idx").on(t.userId, t.createdAt),
  ],
);

/** Stockage de fichiers en base (pilote STORAGE_DRIVER=database). */
export const fichiers = pgTable("fichiers", {
  chemin: varchar("chemin", { length: 500 }).primaryKey(),
  contenu: bytea("contenu").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  taille: bigint("taille", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  etudiant: one(etudiants, { fields: [users.etudiantId], references: [etudiants.id] }),
  enseignant: one(enseignants, { fields: [users.enseignantId], references: [enseignants.id] }),
  alertes: many(alertes),
}));

export const formationsRelations = relations(formations, ({ many }) => ({
  ues: many(ues),
  inscriptions: many(inscriptions),
}));

export const anneesRelations = relations(anneesAcademiques, ({ many }) => ({
  inscriptions: many(inscriptions),
}));

export const uesRelations = relations(ues, ({ one, many }) => ({
  formation: one(formations, { fields: [ues.formationId], references: [formations.id] }),
  affectations: many(affectationEnseignant),
  inscriptionUes: many(inscriptionUe),
  examens: many(examens),
}));

export const etudiantsRelations = relations(etudiants, ({ many }) => ({
  inscriptions: many(inscriptions),
  pieces: many(piecesAdministratives),
}));

export const inscriptionsRelations = relations(inscriptions, ({ one, many }) => ({
  etudiant: one(etudiants, { fields: [inscriptions.idEtudiant], references: [etudiants.id] }),
  formation: one(formations, { fields: [inscriptions.idFormation], references: [formations.id] }),
  annee: one(anneesAcademiques, {
    fields: [inscriptions.idAnneeAcademique],
    references: [anneesAcademiques.id],
  }),
  versements: many(versements),
  echeances: many(echeances),
  resultats: many(resultatsExamens),
  inscriptionUes: many(inscriptionUe),
}));

export const inscriptionUeRelations = relations(inscriptionUe, ({ one }) => ({
  inscription: one(inscriptions, { fields: [inscriptionUe.inscriptionId], references: [inscriptions.id] }),
  ue: one(ues, { fields: [inscriptionUe.ueId], references: [ues.id] }),
}));

export const versementsRelations = relations(versements, ({ one }) => ({
  inscription: one(inscriptions, { fields: [versements.inscriptionId], references: [inscriptions.id] }),
}));

export const echeancesRelations = relations(echeances, ({ one }) => ({
  inscription: one(inscriptions, { fields: [echeances.inscriptionId], references: [inscriptions.id] }),
}));

export const enseignantsRelations = relations(enseignants, ({ many }) => ({
  affectations: many(affectationEnseignant),
}));

export const affectationsRelations = relations(affectationEnseignant, ({ one }) => ({
  enseignant: one(enseignants, {
    fields: [affectationEnseignant.enseignantId],
    references: [enseignants.id],
  }),
  ue: one(ues, { fields: [affectationEnseignant.ueId], references: [ues.id] }),
}));

export const examensRelations = relations(examens, ({ one, many }) => ({
  ue: one(ues, { fields: [examens.ueId], references: [ues.id] }),
  annee: one(anneesAcademiques, {
    fields: [examens.anneeAcademiqueId],
    references: [anneesAcademiques.id],
  }),
  resultats: many(resultatsExamens),
}));

export const resultatsRelations = relations(resultatsExamens, ({ one }) => ({
  examen: one(examens, { fields: [resultatsExamens.examenId], references: [examens.id] }),
  inscription: one(inscriptions, {
    fields: [resultatsExamens.inscriptionId],
    references: [inscriptions.id],
  }),
}));

export const piecesRelations = relations(piecesAdministratives, ({ one }) => ({
  etudiant: one(etudiants, { fields: [piecesAdministratives.etudiantId], references: [etudiants.id] }),
}));

export const candidaturesRelations = relations(candidatures, ({ one }) => ({
  formation: one(formations, { fields: [candidatures.formationId], references: [formations.id] }),
  annee: one(anneesAcademiques, {
    fields: [candidatures.anneeAcademiqueId],
    references: [anneesAcademiques.id],
  }),
  etudiant: one(etudiants, { fields: [candidatures.etudiantId], references: [etudiants.id] }),
}));

export const alertesRelations = relations(alertes, ({ one }) => ({
  user: one(users, { fields: [alertes.userId], references: [users.id] }),
}));

export const journalAuditRelations = relations(journalAudit, ({ one }) => ({
  user: one(users, { fields: [journalAudit.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Etudiant = typeof etudiants.$inferSelect;
export type Inscription = typeof inscriptions.$inferSelect;
export type Versement = typeof versements.$inferSelect;
export type Echeance = typeof echeances.$inferSelect;
export type Examen = typeof examens.$inferSelect;
export type ResultatExamen = typeof resultatsExamens.$inferSelect;
export type Ue = typeof ues.$inferSelect;
export type Formation = typeof formations.$inferSelect;
