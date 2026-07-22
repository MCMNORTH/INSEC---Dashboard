# Cahier des Charges Fonctionnel et Technique (V2 — Révisée MVP)

## Projet : Tableau de Bord d'Administration et de Suivi Académique
**Établissement :** INSEC (Centre associé CNAM INTEC)  
**Auteurs :** Équipe Projet INSEC  

---

## 1. Contexte et Objectifs du Projet
Dans le cadre de ses activités de formation, l'INSEC (Centre associé CNAM INTEC) assure le suivi de ses apprenants. Ce projet consiste à développer un **tableau de bord opérationnel centralisé** destiné à l'équipe administrative et au corps professoral. 

L'outil vise à éradiquer l'éparpillement des données sur des supports isolés, à fiabiliser le suivi financier des inscriptions, et à proposer des indicateurs de synthèse fiables en temps réel pour la direction de l'établissement.

---

## 2. Définition stricte du Périmètre du MVP (Version 1)
Pour garantir une livraison rapide, fiable et conforme aux recommandations, le périmètre de la V1 a été volontairement restreint aux modules indispensables.

###  Ce qui est INCLUS dans le MVP :
1. **Authentification et gestion des droits** pour les profils administratifs et enseignants.
2. **Gestion complète du cycle de vie des Étudiants** Opérations CRUD complètes et sécurisées.
3. **Cartographie et Affectation des Enseignants :** Gestion dynamique par année académique.
4. **Suivi Rigoureux des Paiements :** Enregistrement des flux unitaires réels.
5. **Tableau de Bord Principal :** Consolidation en temps réel des 5 indicateurs clés d'activité.

###  Ce qui est HORS MVP (Reporté aux versions ultérieures) :
* Espace de connexion ou rôle direct pour les **Étudiants**.
* Module de gestion documentaire avancée.
* Planification des sessions d'examens et calcul automatisé des moyennes semestrielles.

---

## 3. Spécifications Fonctionnelles des Modules

### 3.1 Authentification et Gestion des Rôles 
Le système propose un écran de connexion unique distribuant deux profils d'utilisateurs via une table centrale commune (`USERS`) :
* **Administrateur :** Accès total (Lecture/Écriture/Suppression sécurisée) sur l'ensemble de l'application (étudiants, enseignants, inscriptions, paiements).
* **Enseignant :** Accès en lecture seule à son profil et aux listes d'étudiants rattachés aux matières qu'il dispense. Aucun accès aux modules financiers.

### 3.2 Module : Gestion des Étudiants 
L'application doit permettre aux administrateurs d'exécuter les cas d'utilisation suivants :
* **Ajouter / Modifier :** Enregistrement d'un nouvel apprenant ou mise à jour de sa fiche.
* **Supprimer :** Restreint par contrainte d'intégrité (interdit si un historique financier est existant).
* **Rechercher :** Par recherche textuelle dynamique sur le `Nom` ou le `Prénom`.
* **Filtrer :** Tri multicritère par `Formation` rattachée et par `Année académique`.

**Champs minimaux obligatoires par étudiant :**
* Nom
* Prénom
* E-mail (Unique, vérifié par expression régulière)
* Formation (Liaison dynamique)
* Année académique (Format normalisé ex: `2025-2026`)
* Statut (Valeurs harmonisées :  `Actif`, `Suspendu`, `Diplômé`, `Abandon`)

###3.3 Module : Inscriptions et Suivi Financier
Afin de garantir un modèle hautement normalisé et sans redondance, le système sépare l'engagement de facturation des flux réels :
* **Facturation fixe :** Le montant global dû pour l'année scolaire est consigné une seule fois dans le dossier d'`INSCRIPTION`.
* **Flux de transactions :** La table `PAIEMENT` fait office de carnet de reçus chronologique. Elle enregistre chaque versement unitaire effectif (`montant_verse`).
* **Calculs dynamiques :** Le *Solde Restant à payer* et le *Statut financier global* ne sont pas stockés en base de données. Ils sont calculés à la volée par le code applicatif pour éviter tout risque d'incohérence comptable.

**Champs obligatoires suivis en base :**
* Montant dû initial (lié à l'inscription)
* Montant versé (propre à chaque transaction unitaire)
* Date de paiement (horodatage automatique)
* Statut de la transaction (`Validée`, `Rejetée`, `En attente`)

### 3.4 Module : Tableau de Bord Principal 
La page d'accueil de l'administration affiche instantanément une vue synthétique consolidée composée de **5 indicateurs obligatoires** :
1.  **Nombre total d'étudiants :** Somme globale de tous les étudiants enregistrés en base.
2.  **Étudiants actifs :** Nombre d'étudiants ayant le statut `Actif` sur l'année académique courante.
3.  **Paiements encaissés :** Somme cumulée de toutes les transactions financières au statut `Validée`.
4.  **Paiements en attente :** Somme cumulée de tous les soldes restants à recouvrer auprès des étudiants non à jour.
5.  **Nombre d'enseignants :** Total des enseignants enregistrés dans le système.

---

## 4. Spécifications Techniques et Normalisation de la Base de Données

Pour répondre aux exigences de cohérence et supprimer les redondances, le Modèle Logique de Données (MLD) cible est arrêté selon la structure normalisée suivante :

### 4.1 Structure des Tables (MVP)
* **USERS :** `id_user (PK)`, email (unique), password (haché), role (`admin`, `enseignant`), created_at.
* **ADMINISTRATEUR :** `id_admin (PK)`, id_user (FK), nom, prenom, telephone.
* **ENSEIGNANT :** `id_enseignant (PK)`, id_user (FK), nom, prenom, telephone, specialite.
* **FORMATION :** `id_formation (PK)`, nom_formation , code_formation, niveau.
* **ANNEE_ACADEMIQUE :** `id_annee` (PK), `annee_scolaire` (UNIQUE).
* **INSCRIPTION :** `id_inscription (PK)`, id_etudiant (FK), id_formation (FK), id_annee (FK), date_inscription, montant_total_du, statut (`Active`, `Terminée`, `Abandon`).
* **ETUDIANT :** `id_etudiant (PK)`, nom, prenom, email (unique), telephone, statut_etudiant (`Actif`, `Suspendu`, `Diplômé`).
* **PAIEMENT :** `id_paiement (PK)`, id_inscription (FK), montant_verse, date_paiement, statut_transaction.
* **UE :** `id_ue (PK)`, id_formation (FK), code_ue (unique), intitule, credit.
* **AFFECTATION_ENSEIGNANT :** `id_affectation (PK)`, id_ue (FK), id_enseignant (FK), id_annee (FK).

### 4.2 Règles d'Intégrité et Contraintes Métier 
Pour sécuriser le stockage avant le développement, les verrous suivants sont configurés au niveau SQL :
* **Unicité stricte :** L'adresse e-mail de l'utilisateur, l'e-mail de l'étudiant et le code de l'UE sont strictement uniques en base.
* **Sécurisation Anti-Doublon :** Une contrainte d'unicité composite sur le triplet `(id_etudiant, id_formation, id_annee)` dans la table `INSCRIPTION` interdit à un étudiant d'être inscrit deux fois à la même formation pour une même année académique.
* **Sécurité Comptable :** Application d’une règle `ON DELETE RESTRICT` sur les clés étrangères d'inscription et d'étudiant. Le SGBD bloque automatiquement toute tentative de suppression d'un profil si une transaction comptable lui est adossée dans la table `PAIEMENT`.

---

### 4.3 Schéma Relationnel mis à jour
Le graphique mis à jour respectant l'ensemble de ces spécifications et liaisons est intégré sous la nomenclature officielle :

![Schéma Relationnel - INSEC](schema_relationnel_INSEC.png)
---

## 5. Pile Technologique (Stack Technique)
* **Base de données :** `MySQL 8.0` (Moteur InnoDB requis pour la stricte exécution des clés étrangères et des contraintes d'intégrité relationnelles).
* **Back-End (Framework) :** `PHP 8.2+` avec **Laravel 11**. Recours à l'ORM *Eloquent* pour sécuriser les requêtes contre les injections SQL et au package natif d'authentification pour scinder les sessions Admin/Enseignant.
* **Front-End :** `HTML5` / `Tailwind CSS` (Interface d'administration adaptative et épurée) et bibliothèque `Chart.js` pour la mise en forme graphique des indicateurs financiers et volumétriques du Dashboard.

---

## 6. Règles de Contribution et Workflow GitHub 
Afin de collaborer efficacement et de maintenir la stabilité de la branche principale, l'équipe s'astreint au respect de la méthodologie Git suivante :

1.  **Isolation des développements :** Interdiction formelle de pousser (*push*) du code directement sur la branche principale (`main`). Chaque ticket ou tâche issue des problèmes GitHub doit faire l'objet d'une branche locale dédiée nommée selon le formalisme : `feature/nom-de-la-fonctionnalite` (ex: `feature/authentification-roles`).
2.  **Soumission par Pull Request (PR) :** Le rapatriement du code sur la branche `main` s’effectue exclusivement par le biais d'une *Pull Request* sur l'interface GitHub.
3.  **Nommage Explicite et Liaison :** Les titres des PR et des commits associés doivent être explicites et mentionner formellement le numéro du problème résolu (ex: `Feat: Implémentation du filtrage multi-critères, Closes #6`).
4.  **Revue de Code et Intégration :** Aucune fusion (*merge*) ne sera tolérée sans une relecture croisée de l'encadrant et la résolution préalable d'éventuels conflits de fusion.
