import { auditerDirect, auditerModele, trace } from '../lib/audit.js';
import { introuvable, operation } from '../lib/contexte.js';
import { col, exiger } from '../lib/donnees.js';
import { bucket, db } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { MIME_PIECES, ROLES_ADMIN, STATUTS_PIECE, TAILLE_MAX_PIECE, TYPES_PIECE } from '../shared/domaine.js';

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
