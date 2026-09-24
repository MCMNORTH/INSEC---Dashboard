import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { alertes, echeances, etudiants, inscriptions, journalAudit, passwordResetCodes, users } from "@/db/schema";
import { modifier } from "@/lib/audit";
import { hacher } from "@/lib/auth/password";
import { ForbiddenError } from "@/lib/errors";
import { archiverAlerte, lireAlerte, nombreNonLues, synchroniserAlertes } from "@/lib/services/alertes";
import { authentifier, demanderCode, reinitialiser, verifierCode } from "@/lib/services/auth";
import { basculerCompte, creerCompte } from "@/lib/services/comptes";
import { creerEtudiant } from "@/lib/services/etudiants";
import { boiteMail, creerUtilisateur, ctx, etudiantInscrit, formation, premiereAnnee, uesDe } from "../aide";

describe("Journal d’audit", () => {
  it("attribue les changements à l’utilisateur connecté et ne garde que les champs modifiés", async () => {
    const admin = await creerUtilisateur("admin");
    const f = await formation("DGC");
    const a = await premiereAnnee();
    const ues = await uesDe("DGC", 1);
    const id = await creerEtudiant(ctx(admin), {
      nom: "Ba",
      prenom: "Awa",
      email: "awa@example.com",
      statut_etudiant: "Actif",
      formation_id: f.id,
      annee_academique_id: a.id,
      annee_parcours: 1,
      date_inscription: "2026-09-01",
      ue_ids: [ues[0].id],
    });
    await getDb().transaction((tx) => modifier(tx, ctx(admin), etudiants, "Etudiant", id, { telephone: "22000000", nom: "Ba" }));
    const creation = await getDb()
      .select()
      .from(journalAudit)
      .where(and(eq(journalAudit.modele, "Etudiant"), eq(journalAudit.action, "created")));
    expect(creation[0].userId).toBe(admin.id);
    expect(creation[0].adresseIp).toBe("203.0.113.7");
    const [maj] = await getDb()
      .select()
      .from(journalAudit)
      .where(and(eq(journalAudit.modele, "Etudiant"), eq(journalAudit.action, "updated")));
    expect(maj.apres).toEqual({ telephone: "22000000" });
    expect(maj.avant).toEqual({ telephone: null });
  });

  it("ne stocke jamais de mot de passe", async () => {
    const admin = await creerUtilisateur("admin");
    await getDb().transaction(async (tx) => modifier(tx, ctx(admin), users, "User", admin.id, { password: await hacher("secret-hash") }));
    await creerCompte(ctx(admin), {
      name: "Finance",
      email: "finance@example.com",
      password: "motdepasse1",
      password_confirmation: "motdepasse1",
      role: "finance",
    });
    const logs = await getDb().select().from(journalAudit).where(eq(journalAudit.modele, "User"));
    const texte = JSON.stringify(logs);
    expect(texte).not.toContain("password");
    expect(texte).not.toContain("$2b$");
  });
});

describe("Comptes et accès", () => {
  it("crée un compte étudiant rattaché à son dossier et refuse un compte étudiant sans dossier", async () => {
    const admin = await creerUtilisateur("admin");
    const { etudiant } = await etudiantInscrit();
    const base = { name: "Mariam", email: "mariam.compte@example.com", password: "motdepasse1", password_confirmation: "motdepasse1", role: "etudiant" };
    await expect(creerCompte(ctx(admin), base)).rejects.toThrow("Un dossier étudiant est obligatoire.");
    await creerCompte(ctx(admin), { ...base, etudiant_id: String(etudiant.id) });
    const [u] = await getDb().select().from(users).where(eq(users.email, "mariam.compte@example.com"));
    expect(u.etudiantId).toBe(etudiant.id);
    expect(u.password).not.toBe("motdepasse1");
    await expect(creerCompte(ctx(admin), { ...base, email: "deux@example.com", etudiant_id: String(etudiant.id) })).rejects.toThrow(
      "déjà rattaché",
    );
    await expect(creerCompte(ctx(admin), { ...base, email: "x@example.com", role: "super_admin" })).rejects.toThrow("rôle");
  });

  it("un administrateur ne peut ni se désactiver ni désactiver un super admin", async () => {
    const admin = await creerUtilisateur("admin");
    const chef = await creerUtilisateur("super_admin");
    await expect(basculerCompte(ctx(admin), admin.id)).rejects.toThrow("propre compte");
    await expect(basculerCompte(ctx(admin), chef.id)).rejects.toThrow("super administrateur");
    const finance = await creerUtilisateur("finance");
    expect(await basculerCompte(ctx(admin), finance.id)).toBe(false);
    expect(await basculerCompte(ctx(chef), finance.id)).toBe(true);
  });
});

describe("Connexion et mot de passe", () => {
  it("authentifie, refuse un mauvais mot de passe et un compte désactivé", async () => {
    const u = await creerUtilisateur("admin");
    expect((await authentifier(getDb(), { email: u.email.toUpperCase(), password: "motdepasse-solide" }, "1.1.1.1")).id).toBe(u.id);
    await expect(authentifier(getDb(), { email: u.email, password: "mauvais" }, "1.1.1.1")).rejects.toThrow("identifiants");
    await getDb().update(users).set({ active: false }).where(eq(users.id, u.id));
    await expect(authentifier(getDb(), { email: u.email, password: "motdepasse-solide" }, "1.1.1.1")).rejects.toThrow("désactivé");
  });

  it("bloque après 5 échecs pour la même adresse et la même IP", async () => {
    const u = await creerUtilisateur("admin");
    for (let i = 0; i < 5; i++) {
      await expect(authentifier(getDb(), { email: u.email, password: "mauvais" }, "2.2.2.2")).rejects.toThrow("identifiants");
    }
    await expect(authentifier(getDb(), { email: u.email, password: "motdepasse-solide" }, "2.2.2.2")).rejects.toThrow("Trop de tentatives");
    // Une autre IP n'est pas bloquée.
    expect((await authentifier(getDb(), { email: u.email, password: "motdepasse-solide" }, "3.3.3.3")).id).toBe(u.id);
  });

  it("réinitialise le mot de passe avec le code reçu par e-mail et révoque les sessions", async () => {
    const u = await creerUtilisateur("etudiant");
    await demanderCode(getDb(), { email: u.email });
    const code = boiteMail.at(-1)!.details!.Code;
    expect(code).toMatch(/^\d{6}$/);
    const [ligne] = await getDb().select().from(passwordResetCodes);
    expect(ligne.codeHash).not.toContain(code);

    await expect(verifierCode(getDb(), u.email, code === "000000" ? "111111" : "000000")).rejects.toThrow("invalide");
    await reinitialiser(getDb(), { email: u.email, code, password: "nouveau-mdp-1", password_confirmation: "nouveau-mdp-1" });
    const [apres] = await getDb().select().from(users).where(eq(users.id, u.id));
    expect(apres.sessionVersion).toBe(u.sessionVersion + 1);
    expect((await authentifier(getDb(), { email: u.email, password: "nouveau-mdp-1" }, "4.4.4.4")).id).toBe(u.id);
    // Le code est à usage unique.
    await expect(verifierCode(getDb(), u.email, code)).rejects.toThrow("expiré");
  });

  it("ne révèle pas si une adresse existe et invalide le code après 5 essais", async () => {
    await demanderCode(getDb(), { email: "inconnu@example.com" });
    expect(boiteMail).toHaveLength(0);
    const u = await creerUtilisateur("admin");
    await demanderCode(getDb(), { email: u.email });
    const code = boiteMail.at(-1)!.details!.Code;
    const faux = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await expect(verifierCode(getDb(), u.email, faux)).rejects.toThrow();
    await expect(verifierCode(getDb(), u.email, code)).rejects.toThrow("expiré");
  });
});

describe("Centre d’alertes", () => {
  it("crée les alertes de retard, et un étudiant ne peut pas lire l’alerte d’un autre", async () => {
    const admin = await creerUtilisateur("admin");
    const { etudiant, inscription } = await etudiantInscrit();
    await getDb().update(inscriptions).set({ montantDu: 100000 }).where(eq(inscriptions.id, inscription.id));
    await getDb().insert(echeances).values({ inscriptionId: inscription.id, libelle: "T1", montant: 30000, dateEcheance: "2025-01-01" });
    const eleve = await creerUtilisateur("etudiant", { etudiantId: etudiant.id });

    await synchroniserAlertes(getDb(), admin);
    await synchroniserAlertes(getDb(), eleve);
    const [alerteAdmin] = await getDb().select().from(alertes).where(eq(alertes.userId, admin.id));
    expect(alerteAdmin.message).toContain("30 000 MRU");
    const [alerteEleve] = await getDb().select().from(alertes).where(eq(alertes.userId, eleve.id));
    expect(alerteEleve.titre).toBe("Échéance de paiement dépassée");

    await expect(lireAlerte(getDb(), eleve.id, alerteAdmin.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await nombreNonLues(getDb(), eleve.id)).toBe(1);
    expect(await lireAlerte(getDb(), eleve.id, alerteEleve.id)).toBe("/portail/etudiant");
    expect(await nombreNonLues(getDb(), eleve.id)).toBe(0);
    await archiverAlerte(getDb(), eleve.id, alerteEleve.id);
    const [archivee] = await getDb().select().from(alertes).where(eq(alertes.id, alerteEleve.id));
    expect(archivee.archiveeAt).not.toBeNull();
  });
});
