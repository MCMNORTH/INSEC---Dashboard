CREATE TABLE "affectation_enseignant" (
	"id" serial PRIMARY KEY NOT NULL,
	"enseignant_id" integer NOT NULL,
	"ue_id" integer NOT NULL,
	"nombre_etudiants" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cle" varchar(255) NOT NULL,
	"type" varchar(30) NOT NULL,
	"niveau" varchar(20) DEFAULT 'info' NOT NULL,
	"titre" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"lien" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"lue_at" timestamp with time zone,
	"archivee_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annees_academiques" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(50) NOT NULL,
	"nom" varchar(255) NOT NULL,
	"prenom" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telephone" varchar(255) NOT NULL,
	"date_naissance" date,
	"dernier_diplome" varchar(255) NOT NULL,
	"formation_id" integer NOT NULL,
	"annee_academique_id" integer NOT NULL,
	"motivation" text,
	"statut" varchar(20) DEFAULT 'Nouvelle' NOT NULL,
	"note_interne" text,
	"etudiant_id" integer,
	"traitee_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidatures_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "echeances" (
	"id" serial PRIMARY KEY NOT NULL,
	"inscription_id" integer NOT NULL,
	"libelle" varchar(255) NOT NULL,
	"montant" integer NOT NULL,
	"date_echeance" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enseignants" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(255) NOT NULL,
	"prenom" varchar(255) NOT NULL,
	"specialite" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telephone" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enseignants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "etudiants" (
	"id_etudiant" serial PRIMARY KEY NOT NULL,
	"nom" varchar(255) NOT NULL,
	"prenom" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telephone" varchar(255),
	"statut_etudiant" varchar(20) DEFAULT 'Actif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etudiants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "examens" (
	"id" serial PRIMARY KEY NOT NULL,
	"ue_id" integer NOT NULL,
	"annee_academique_id" integer NOT NULL,
	"session" varchar(20) DEFAULT 'Normale' NOT NULL,
	"date_examen" timestamp with time zone NOT NULL,
	"salle" varchar(255),
	"note_sur" numeric(5, 2) DEFAULT 20 NOT NULL,
	"seuil_validation" numeric(5, 2) DEFAULT 10 NOT NULL,
	"statut" varchar(20) DEFAULT 'Planifié' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fichiers" (
	"chemin" varchar(500) PRIMARY KEY NOT NULL,
	"contenu" "bytea" NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"taille" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(10),
	"nom" varchar(255) NOT NULL,
	"libelle" varchar(255),
	"duree_annees" smallint DEFAULT 1 NOT NULL,
	"niveau_diplome" varchar(255),
	"credits_total" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_url" varchar(500),
	"source_verifiee_le" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "formations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inscription_ue" (
	"id" serial PRIMARY KEY NOT NULL,
	"inscription_id" integer NOT NULL,
	"ue_id" integer NOT NULL,
	"statut" varchar(20) DEFAULT 'inscrite' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_etudiant" integer NOT NULL,
	"id_formation" integer NOT NULL,
	"id_annee_academique" integer NOT NULL,
	"annee_parcours" smallint,
	"date_inscription" date,
	"numero_inscription_intec" varchar(255),
	"statut" varchar(20) DEFAULT 'active' NOT NULL,
	"montant_du" integer DEFAULT 0 NOT NULL,
	"montant_remise" integer DEFAULT 0 NOT NULL,
	"note_financiere" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"acteur" varchar(255),
	"action" varchar(50) NOT NULL,
	"modele" varchar(100),
	"modele_id" varchar(100),
	"description" varchar(500) NOT NULL,
	"avant" jsonb,
	"apres" jsonb,
	"adresse_ip" varchar(45),
	"user_agent" text,
	"route" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"destinataire" varchar(255) NOT NULL,
	"nom_destinataire" varchar(255),
	"type" varchar(50) NOT NULL,
	"sujet" varchar(255) NOT NULL,
	"statut" varchar(20) DEFAULT 'En attente' NOT NULL,
	"erreur" text,
	"envoye_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" varchar(320) PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_codes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pieces_administratives" (
	"id" serial PRIMARY KEY NOT NULL,
	"etudiant_id" integer NOT NULL,
	"type" varchar(100) NOT NULL,
	"nom_original" varchar(255) NOT NULL,
	"chemin" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"taille" bigint NOT NULL,
	"statut" varchar(20) DEFAULT 'À vérifier' NOT NULL,
	"date_expiration" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resultats_examens" (
	"id" serial PRIMARY KEY NOT NULL,
	"examen_id" integer NOT NULL,
	"inscription_id" integer NOT NULL,
	"presence" varchar(20) DEFAULT 'Convoqué' NOT NULL,
	"note" numeric(5, 2),
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ues" (
	"id" serial PRIMARY KEY NOT NULL,
	"formation_id" integer,
	"code" varchar(255) NOT NULL,
	"libelle" varchar(255) NOT NULL,
	"credits" smallint DEFAULT 0 NOT NULL,
	"annee_parcours" smallint,
	"ordre" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password" varchar(255) NOT NULL,
	"role" varchar(30) DEFAULT 'enseignant' NOT NULL,
	"etudiant_id" integer,
	"enseignant_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_etudiant_id_unique" UNIQUE("etudiant_id"),
	CONSTRAINT "users_enseignant_id_unique" UNIQUE("enseignant_id")
);
--> statement-breakpoint
CREATE TABLE "versements" (
	"id" serial PRIMARY KEY NOT NULL,
	"inscription_id" integer NOT NULL,
	"montant" integer NOT NULL,
	"mode_paiement" varchar(30) DEFAULT 'Espèces' NOT NULL,
	"reference" varchar(255),
	"numero_recu" varchar(255),
	"date_versement" date NOT NULL,
	"statut" varchar(20) DEFAULT 'En attente' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "versements_numero_recu_unique" UNIQUE("numero_recu")
);
--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_enseignant_enseignant_id_enseignants_id_fk" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_enseignant_ue_id_ues_id_fk" FOREIGN KEY ("ue_id") REFERENCES "public"."ues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_annee_academique_id_annees_academiques_id_fk" FOREIGN KEY ("annee_academique_id") REFERENCES "public"."annees_academiques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_etudiant_id_etudiants_id_etudiant_fk" FOREIGN KEY ("etudiant_id") REFERENCES "public"."etudiants"("id_etudiant") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_inscription_id_inscriptions_id_fk" FOREIGN KEY ("inscription_id") REFERENCES "public"."inscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examens" ADD CONSTRAINT "examens_ue_id_ues_id_fk" FOREIGN KEY ("ue_id") REFERENCES "public"."ues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examens" ADD CONSTRAINT "examens_annee_academique_id_annees_academiques_id_fk" FOREIGN KEY ("annee_academique_id") REFERENCES "public"."annees_academiques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscription_ue" ADD CONSTRAINT "inscription_ue_inscription_id_inscriptions_id_fk" FOREIGN KEY ("inscription_id") REFERENCES "public"."inscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscription_ue" ADD CONSTRAINT "inscription_ue_ue_id_ues_id_fk" FOREIGN KEY ("ue_id") REFERENCES "public"."ues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_id_etudiant_etudiants_id_etudiant_fk" FOREIGN KEY ("id_etudiant") REFERENCES "public"."etudiants"("id_etudiant") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_id_formation_formations_id_fk" FOREIGN KEY ("id_formation") REFERENCES "public"."formations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_id_annee_academique_annees_academiques_id_fk" FOREIGN KEY ("id_annee_academique") REFERENCES "public"."annees_academiques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces_administratives" ADD CONSTRAINT "pieces_administratives_etudiant_id_etudiants_id_etudiant_fk" FOREIGN KEY ("etudiant_id") REFERENCES "public"."etudiants"("id_etudiant") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultats_examens" ADD CONSTRAINT "resultats_examens_examen_id_examens_id_fk" FOREIGN KEY ("examen_id") REFERENCES "public"."examens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultats_examens" ADD CONSTRAINT "resultats_examens_inscription_id_inscriptions_id_fk" FOREIGN KEY ("inscription_id") REFERENCES "public"."inscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ues" ADD CONSTRAINT "ues_formation_id_formations_id_fk" FOREIGN KEY ("formation_id") REFERENCES "public"."formations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_etudiant_id_etudiants_id_etudiant_fk" FOREIGN KEY ("etudiant_id") REFERENCES "public"."etudiants"("id_etudiant") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_enseignant_id_enseignants_id_fk" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versements" ADD CONSTRAINT "versements_inscription_id_inscriptions_id_fk" FOREIGN KEY ("inscription_id") REFERENCES "public"."inscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affectation_enseignant_unique" ON "affectation_enseignant" USING btree ("enseignant_id","ue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alertes_user_cle_unique" ON "alertes" USING btree ("user_id","cle");--> statement-breakpoint
CREATE INDEX "alertes_user_active_idx" ON "alertes" USING btree ("user_id","active","lue_at");--> statement-breakpoint
CREATE UNIQUE INDEX "candidatures_email_annee_unique" ON "candidatures" USING btree ("email","annee_academique_id");--> statement-breakpoint
CREATE INDEX "candidatures_statut_created_idx" ON "candidatures" USING btree ("statut","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inscription_ue_unique" ON "inscription_ue" USING btree ("inscription_id","ue_id");--> statement-breakpoint
CREATE INDEX "inscriptions_etudiant_statut_idx" ON "inscriptions" USING btree ("id_etudiant","statut");--> statement-breakpoint
CREATE INDEX "journal_audit_action_idx" ON "journal_audit" USING btree ("action","modele","created_at");--> statement-breakpoint
CREATE INDEX "journal_audit_user_idx" ON "journal_audit" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_emails_type_statut_idx" ON "journal_emails" USING btree ("type","statut","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resultats_examens_unique" ON "resultats_examens" USING btree ("examen_id","inscription_id");--> statement-breakpoint
CREATE INDEX "ues_formation_annee_idx" ON "ues" USING btree ("formation_id","annee_parcours");