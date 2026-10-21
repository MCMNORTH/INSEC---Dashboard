import { auditerDirect, auditerModele, trace } from '../lib/audit.js';
import { introuvable, operation } from '../lib/contexte.js';
import { col, exiger } from '../lib/donnees.js';
import { bucket, db } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import {
    MIME_PIECES, ROLES_ADMIN, ROLES_FINANCE, STATUTS_PIECE, TAILLE_MAX_PIECE, TYPES_DOCUMENT_FINANCIER, TYPES_PIECE,
} from '../shared/domaine.js';

/** Télécharge le PDF original de la convention, conservé dans le stockage privé. */
export const telechargerConventionIntec = operation('telechargerConventionIntec', ROLES_ADMIN, async (_donnees, acteur) => {
    const fichier = bucket().file('documents/convention-intec-2024.pdf');
    const [existe] = await fichier.exists();
    if (!existe) introuvable('Le PDF de la convention n’est pas encore disponible.');
    const [meta] = await fichier.getMetadata();
    if (meta.contentType !== 'application/pdf' || Number(meta.size ?? 0) > 5 * 1024 * 1024) {
        throw new Error('Le fichier de convention stocké est invalide.');
    }
    const [contenu] = await fichier.download();
    await auditerDirect(acteur, {
        action: 'download',
        modele: 'ConventionINTEC',
        modeleId: 'convention-intec-2024',
        description: 'Téléchargement du PDF original de la convention INSEC–CNAM INTEC',
        apres: { nom: 'Convention INSEC- Mauritanie-Oct2024.pdf', taille: Number(meta.size ?? 0) },
    });
    return {
        nom: 'Convention INSEC - Mauritanie - octobre 2024.pdf',
        mimeType: 'application/pdf',
        contenu: contenu.toString('base64'),
    };
});

/** Enregistre une pièce déjà téléversée par le navigateur dans dossiers/{etudiantId}/. */
export const enregistrerPiece = operation('enregistrerPiece', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            etudiantId: s.id(),
            chemin: z.string().max(500),
            nomOriginal: s.texte(255),
            type: s.choix(TYPES_PIECE),
            dateExpiration: s.dateOptionnelle(),
            note: s.texteOptionnel(1000),
        }),
        donnees,
    );
    if (!v.chemin.startsWith(`dossiers/${v.etudiantId}/`) || v.chemin.includes('..')) erreurChamp('fichier', 'Emplacement de fichier invalide.');
    await exiger(null, col.etudiants().doc(v.etudiantId), 'Étudiant introuvable.');
    const fichier = bucket().file(v.chemin);
    const [existe] = await fichier.exists();
    if (!existe) erreurChamp('fichier', 'Le fichier n’a pas été reçu.');
    const [meta] = await fichier.getMetadata();
    const taille = Number(meta.size ?? 0);
    if (!MIME_PIECES.includes(meta.contentType as (typeof MIME_PIECES)[number]) || taille > TAILLE_MAX_PIECE) {
        await fichier.delete({ ignoreNotFound: true });
        erreurChamp('fichier', 'Seuls les fichiers PDF, JPG ou PNG de 5 Mo maximum sont acceptés.');
    }
    const ref = col.pieces().doc();
    const piece = {
        etudiantId: v.etudiantId, type: v.type, nomOriginal: v.nomOriginal, chemin: v.chemin, mimeType: meta.contentType,
        taille, statut: 'À vérifier', dateExpiration: v.dateExpiration, note: v.note,
    };
    const lot = db.batch();
    lot.set(ref, { ...piece, ...trace(acteur, true) });
    auditerModele(lot, acteur, 'PieceAdministrative', ref.id, 'created', null, piece);
    await lot.commit();
    return { id: ref.id, message: 'Pièce ajoutée au dossier.' };
});

export const telechargerPiece = operation('telechargerPiece', ROLES_ADMIN, async (donnees, acteur) => {
    const { id } = valider(z.object({ id: s.id() }), donnees);
    const piece = await exiger(null, col.pieces().doc(id), 'Document introuvable.');
    const fichier = bucket().file(piece.chemin);
    const [existe] = await fichier.exists();
    if (!existe) introuvable('Le fichier est introuvable dans le stockage.');
    const [contenu] = await fichier.download();
    await auditerDirect(acteur, {
        action: 'download', modele: 'PieceAdministrative', modeleId: id,
        description: `Téléchargement du document ${piece.nomOriginal}`, apres: { type: piece.type, etudiantId: piece.etudiantId },
    });
    return { nom: piece.nomOriginal as string, mimeType: piece.mimeType as string, contenu: contenu.toString('base64') };
});

export const modifierPiece = operation('modifierPiece', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id(), statut: s.choix(STATUTS_PIECE), note: s.texteOptionnel(1000) }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.pieces().doc(v.id);
        const avant = await exiger(tx, ref, 'Document introuvable.');
        const apres = { statut: v.statut, note: v.note };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'PieceAdministrative', v.id, 'updated', avant, apres);
    });
    return { message: 'Statut de la pièce mis à jour.' };
});

// --- Documents financiers annuels (facture INTEC, justificatif du paiement de l'INSEC) ---
// Réintégré depuis le code de production du 2026-10-19 (tag archive/production-2026-10-19).
// Deux formats existent en base :
//  - actuel : un document par fichier, chemin finances/{année}/{type}/{uid}/{fichier} ;
//  - ancien : un document par année (id = année), champs factureIntec / justificatifPaiement,
//    chemin finances/{année}/{type}.pdf.

type TypeDocumentFinancier = (typeof TYPES_DOCUMENT_FINANCIER)[number];
const CHAMP_ANCIEN: Record<TypeDocumentFinancier, string> = { 'facture-intec': 'factureIntec', 'justificatif-paiement': 'justificatifPaiement' };
const FORMAT_ANNEE = /^20\d{2}-20\d{2}$/;
const estTypeDocument = (valeur: unknown): valeur is TypeDocumentFinancier =>
    (TYPES_DOCUMENT_FINANCIER as readonly unknown[]).includes(valeur);

/** Enregistre un PDF financier déjà téléversé par le navigateur dans finances/{année}/{type}/{uid}/. */
export const enregistrerDocumentFinancier = operation('enregistrerDocumentFinancier', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({
        anneeId: s.id(),
        type: s.choix(TYPES_DOCUMENT_FINANCIER),
        chemin: z.string().max(500),
        nomOriginal: s.texte(255),
    }), donnees);
    const prefixe = `finances/${v.anneeId}/${v.type}/${acteur.uid}/`;
    if (!acteur.uid || !v.chemin.startsWith(prefixe) || v.chemin.split('/').includes('..')) {
        erreurChamp('fichier', 'Emplacement de fichier invalide.');
    }
    await exiger(null, col.annees().doc(v.anneeId), 'Année scolaire introuvable.');
    const fichier = bucket().file(v.chemin);
    const [existe] = await fichier.exists();
    if (!existe) erreurChamp('fichier', 'Le fichier n’a pas été reçu.');
    const [meta] = await fichier.getMetadata();
    const taille = Number(meta.size ?? 0);
    if (meta.contentType !== 'application/pdf' || taille < 1 || taille > TAILLE_MAX_PIECE) {
        await fichier.delete({ ignoreNotFound: true });
        erreurChamp('fichier', 'Seuls les fichiers PDF de 5 Mo maximum sont acceptés.');
    }
    const ref = col.documentsFinanciers().doc();
    const document = { anneeId: v.anneeId, type: v.type, nomOriginal: v.nomOriginal, chemin: v.chemin, mimeType: 'application/pdf', taille };
    const lot = db.batch();
    lot.set(ref, { ...document, ...trace(acteur, true) });
    auditerModele(lot, acteur, 'DocumentFinancier', ref.id, 'created', null, document);
    await lot.commit();
    return { id: ref.id, message: 'Document financier ajouté.' };
});

/** Liste les documents financiers d'une année, dans les deux formats, sans ouvrir la collection au navigateur. */
export const lireDocumentsFinanciers = operation('lireDocumentsFinanciers', ROLES_FINANCE, async (donnees) => {
    const { anneeId } = valider(z.object({ anneeId: s.id() }), donnees);
    const [actuels, ancien] = await Promise.all([
        col.documentsFinanciers().where('anneeId', '==', anneeId).get(),
        col.documentsFinanciers().doc(anneeId).get(),
    ]);
    const date = (valeur: unknown) => (valeur as { toDate?: () => Date } | undefined)?.toDate?.().toISOString() ?? null;
    const liste = actuels.docs
        .filter((d) => estTypeDocument(d.get('type')))
        .map((d) => ({
            id: d.id, type: d.get('type') as TypeDocumentFinancier, nomOriginal: String(d.get('nomOriginal') ?? 'document.pdf'),
            taille: Number(d.get('taille') ?? 0), deposeLe: date(d.get('creeLe')), ancienFormat: false,
        }));
    if (ancien.exists) {
        for (const type of TYPES_DOCUMENT_FINANCIER) {
            const f = ancien.get(CHAMP_ANCIEN[type]) as Record<string, unknown> | undefined;
            if (f?.chemin) liste.push({
                id: anneeId, type, nomOriginal: String(f.nomOriginal ?? 'document.pdf'), taille: Number(f.taille ?? 0),
                deposeLe: date(ancien.get('modifieLe') ?? ancien.get('creeLe')), ancienFormat: true,
            });
        }
    }
    return { documents: liste.sort((a, b) => String(b.deposeLe ?? '').localeCompare(String(a.deposeLe ?? ''))) };
});

export const telechargerDocumentFinancier = operation('telechargerDocumentFinancier', ROLES_FINANCE, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id(), type: s.choix(TYPES_DOCUMENT_FINANCIER).optional() }), donnees);
    const document = await exiger(null, col.documentsFinanciers().doc(v.id), 'Document financier introuvable.');
    let type: TypeDocumentFinancier;
    let anneeId: string;
    let chemin: string;
    let nomOriginal: string;
    let tailleAttendue: number | null;
    let ancienFormat = false;
    if (estTypeDocument(document.type)) {
        type = document.type;
        if (v.type && v.type !== type) introuvable('Document financier introuvable.');
        if (typeof document.anneeId !== 'string' || typeof document.creePar !== 'string') introuvable();
        anneeId = document.anneeId;
        chemin = String(document.chemin ?? '').replace(/\\/g, '/');
        nomOriginal = String(document.nomOriginal ?? 'document.pdf');
        tailleAttendue = Number.isFinite(Number(document.taille)) ? Number(document.taille) : null;
        const prefixe = `finances/${anneeId}/${type}/${document.creePar}/`;
        if (!chemin.startsWith(prefixe) || chemin.split('/').includes('..')) introuvable();
    } else {
        // Ancien format : un document par année (id = année).
        if (!v.type || !FORMAT_ANNEE.test(v.id)) introuvable('Document financier introuvable.');
        type = v.type;
        anneeId = v.id;
        const fichierAncien = document[CHAMP_ANCIEN[type]] as Record<string, unknown> | undefined;
        const cheminAttendu = `finances/${anneeId}/${type}.pdf`;
        if (!fichierAncien || fichierAncien.chemin !== cheminAttendu || fichierAncien.mimeType !== 'application/pdf') {
            introuvable('Document financier introuvable.');
        }
        chemin = cheminAttendu;
        nomOriginal = String(fichierAncien.nomOriginal ?? 'document.pdf');
        tailleAttendue = Number.isFinite(Number(fichierAncien.taille)) ? Number(fichierAncien.taille) : null;
        ancienFormat = true;
    }
    const fichier = bucket().file(chemin);
    const [existe] = await fichier.exists();
    if (!existe) introuvable('Le fichier est introuvable dans le stockage.');
    const [meta] = await fichier.getMetadata();
    const taille = Number(meta.size ?? 0);
    if (meta.contentType !== 'application/pdf' || taille < 1 || taille > TAILLE_MAX_PIECE || (tailleAttendue !== null && taille !== tailleAttendue)) {
        introuvable('Le fichier stocké est invalide.');
    }
    const [contenu] = await fichier.download();
    await auditerDirect(acteur, {
        action: 'download', modele: 'DocumentFinancier', modeleId: v.id,
        description: `Téléchargement du document financier ${nomOriginal}`,
        apres: { anneeId, type, taille, ...(ancienFormat ? { format: 'ancien' } : {}) },
    });
    return { nom: nomOriginal, mimeType: 'application/pdf', contenu: contenu.toString('base64') };
});
