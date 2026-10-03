import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import pdfmake from 'pdfmake';
import { HttpsError } from 'firebase-functions/v2/https';
import { acteurDepuis, operation } from '../lib/contexte.js';
import { col, exiger, type Doc } from '../lib/donnees.js';
import { db, FieldValue, FUSEAU } from '../lib/firebase.js';
import { expedier, SMTP_PASSWORD, transportSmtp, type Email } from '../lib/email.js';
import { s, valider, z } from '../lib/validation.js';
import { formaterMontant, numeroFormate, resultatValide, ROLES_ADMIN } from '../shared/domaine.js';
import { formaterDateHeure } from './examens.js';

const require = createRequire(import.meta.url);
const polices = require('pdfmake/fonts/Roboto.js') as Record<string, Record<string, string>>;
const dossierPolices = dirname(require.resolve('pdfmake/fonts/Roboto.js'));
pdfmake.setFonts(polices);
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((chemin) => chemin.startsWith(dossierPolices));

const BLEU = '#1e2761';
const OR = '#d4af37';
const jourFr = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'short' }).format(d);
const dateFr = (iso: string) => iso.split('-').reverse().join('/');
const maj = (v: string) => (v ?? '').toLocaleUpperCase('fr-FR');

function entete() {
    return [
        { text: 'INSEC', fontSize: 24, bold: true, color: BLEU },
        { text: 'Centre associé INTEC-CNAM · DGC & DSGC', color: '#666666' },
        { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 3, lineColor: OR }], margin: [0, 0, 0, 20] },
    ];
}

const titre = (texte: string) => ({ text: maj(texte), alignment: 'center', fontSize: 20, color: BLEU, margin: [0, 20, 0, 20] });
const encadre = (contenu: unknown[]) => ({
    table: { widths: ['*'], body: [[{ stack: contenu, margin: [8, 8, 8, 8] }]] },
    layout: { fillColor: '#fafafa', hLineColor: '#dddddd', vLineColor: '#dddddd' },
    margin: [0, 10, 0, 10],
});
const grille = (lignes: unknown[][], entetes?: string[]) => ({
    table: {
        headerRows: entetes ? 1 : 0,
        widths: entetes ? entetes.map(() => '*') : [120, '*'],
        body: [...(entetes ? [entetes.map((e) => ({ text: e, color: 'white', fillColor: BLEU, bold: true }))] : []), ...lignes],
    },
    layout: { hLineColor: '#dddddd', vLineColor: '#dddddd', paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 10, 0, 10],
});
const cle = (texte: string) => ({ text: texte, color: 'white', fillColor: BLEU, bold: true });
const signature = (texte: string, prefixe?: string) => ({
    stack: [...(prefixe ? [{ text: prefixe }] : []), { text: texte, bold: true, margin: [0, 20, 0, 0] }],
    alignment: 'right',
    margin: [0, 40, 0, 0],
});

async function document(contenu: unknown[], piedDePage: string): Promise<string> {
    const buffer = await pdfmake
        .createPdf({
            pageMargins: [40, 50, 40, 60],
            defaultStyle: { font: 'Roboto', fontSize: 10, color: '#202020' },
            content: contenu,
            footer: { text: piedDePage, fontSize: 8, color: '#777777', margin: [40, 20, 40, 0] },
        })
        .getBuffer();
    return buffer.toString('base64');
}

async function contexteInscription(id: string) {
    const inscription = await exiger(null, col.inscriptions().doc(id), 'Inscription introuvable.');
    const [etudiant, formation, annee] = await db.getAll(
        col.etudiants().doc(inscription.etudiantId),
        col.formations().doc(inscription.formationId),
        col.annees().doc(inscription.anneeId),
    );
    return { inscription, etudiant: etudiant.data() as Doc, formation: formation.data() as Doc, annee: annee.data() as Doc };
}

async function attestation(id: string) {
    const { inscription, etudiant, formation, annee } = await contexteInscription(id);
    const ues = inscription.ueIds?.length ? await db.getAll(...inscription.ueIds.map((u: string) => col.ues().doc(u))) : [];
    const contenu = [
        ...entete(),
        titre('Attestation d’inscription'),
        { text: 'Nous attestons que :' },
        encadre([
            { text: `${maj(etudiant.nom)} ${etudiant.prenom}`, bold: true },
            `E-mail : ${etudiant.email}`,
            `N° INTEC : ${inscription.numeroIntec ?? 'Non renseigné'}`,
        ]),
        {
            text: [
                'est inscrit(e) au diplôme ', { text: `${formation.libelle} (${formation.code})`, bold: true },
                `, en année ${inscription.anneeParcours}, pour l’année académique `, { text: annee.libelle, bold: true }, '.',
            ],
        },
        { text: `UE suivies : ${ues.map((u) => u.get('code')).join(', ')}.`, margin: [0, 10, 0, 0] },
        signature('La Direction de l’INSEC', `Fait le ${jourFr(new Date())}`),
    ];
    return {
        nom: `attestation-inscription-${id}.pdf`,
        contenu: await document(contenu, `Document généré par INSEC Dashboard · Référence INS-${id}`),
    };
}

async function releve(id: string) {
    const { inscription, etudiant, formation, annee } = await contexteInscription(id);
    const resultats = (await col.resultats().where('inscriptionId', '==', id).get()).docs
        .map((d) => d.data())
        .sort((a, b) => a.dateExamen.toMillis() - b.dateExamen.toMillis());
    const ueIds = [...new Set(resultats.map((r) => r.ueId as string))];
    const ues = new Map((ueIds.length ? await db.getAll(...ueIds.map((u) => col.ues().doc(u))) : []).map((u) => [u.id, u.data() as Doc]));
    const valides = new Set(resultats.filter((r) => resultatValide(r as never)).map((r) => r.ueId as string));
    const credits = [...valides].reduce((t, u) => t + (ues.get(u)?.credits ?? 0), 0);
    const lignes = resultats.length
        ? resultats.map((r) => [
              `${ues.get(r.ueId)?.code ?? r.ueId} · ${ues.get(r.ueId)?.libelle ?? ''}`,
              r.session,
              jourFr(r.dateExamen.toDate()),
              r.note !== null ? `${r.note}/${r.noteSur}` : r.presence,
              resultatValide(r as never) ? 'Validée' : 'Non validée',
          ])
        : [[{ text: 'Aucun résultat enregistré.', colSpan: 5, alignment: 'center' }, '', '', '', '']];
    const contenu = [
        ...entete(),
        titre('Relevé de notes'),
        encadre([
            { text: `${maj(etudiant.nom)} ${etudiant.prenom}`, bold: true },
            `${formation.code} · ${annee.libelle} · Année ${inscription.anneeParcours}`,
            `N° INTEC : ${inscription.numeroIntec ?? 'Non renseigné'}`,
        ]),
        grille(lignes, ['UE', 'Session', 'Date', 'Note', 'Résultat']),
        { text: `Crédits validés : ${credits} ECTS`, fontSize: 15, bold: true, color: BLEU, margin: [0, 10, 0, 0] },
    ];
    return {
        nom: `releve-notes-${id}.pdf`,
        contenu: await document(contenu, `Document généré le ${formaterDateHeure(new Date())} · INSEC Dashboard`),
    };
}

async function convocation(id: string) {
    const resultat = await exiger(null, col.resultats().doc(id), 'Convocation introuvable.');
    const { inscription, etudiant, formation, annee } = await contexteInscription(resultat.inscriptionId);
    const ue = (await col.ues().doc(resultat.ueId).get()).data() as Doc;
    const contenu = [
        ...entete(),
        titre('Convocation à l’examen'),
        { text: 'Étudiant(e) :' },
        encadre([
            { text: `${maj(etudiant.nom)} ${etudiant.prenom}`, bold: true },
            `${formation.code} · N° INTEC ${inscription.numeroIntec ?? 'Non renseigné'}`,
        ]),
        grille([
            [cle('UE'), `${ue.code} · ${ue.libelle}`],
            [cle('Session'), resultat.session],
            [cle('Date et heure'), formaterDateHeure(resultat.dateExamen.toDate())],
            [cle('Lieu / salle'), resultat.salle ?? 'À confirmer'],
            [cle('Année académique'), annee.libelle],
        ]),
        { text: 'Veuillez vous présenter 30 minutes avant l’épreuve avec une pièce d’identité et cette convocation.', margin: [0, 20, 0, 0] },
        signature('La Direction de l’INSEC'),
    ];
    const numero = numeroFormate('CONV', resultat.numeroConvocation ?? 0);
    return {
        nom: `convocation-examen-${numero}.pdf`,
        contenu: await document(contenu, `Convocation n° ${numero} · Générée le ${jourFr(new Date())}`),
    };
}

async function recu(id: string) {
    const versement = await exiger(null, col.versements().doc(id), 'Versement introuvable.');
    const { etudiant, formation, annee } = await contexteInscription(versement.inscriptionId);
    const contenu = [
        ...entete(),
        titre('Reçu de paiement'),
        encadre([
            { text: versement.numeroRecu ?? 'Reçu provisoire', fontSize: 15, bold: true, color: BLEU },
            `Date : ${dateFr(versement.dateVersement)} · Statut : ${versement.statut}`,
        ]),
        grille([
            [cle('Étudiant'), `${maj(etudiant.nom)} ${etudiant.prenom}`],
            [cle('Formation'), `${formation.code} · ${annee.libelle}`],
            [cle('Montant reçu'), { text: `${formaterMontant(versement.montant)} MRU`, fontSize: 15, bold: true, color: BLEU }],
            [cle('Mode'), versement.modePaiement],
            [cle('Référence'), versement.reference ?? '—'],
        ]),
        signature('Service financier INSEC', 'Cachet et signature'),
    ];
    return {
        nom: `recu-${versement.numeroRecu}.pdf`,
        contenu: await document(contenu, `Ce reçu est rattaché à l’inscription n° ${versement.inscriptionId} · INSEC Dashboard`),
    };
}

async function facture(id: string) {
    const { inscription, etudiant, formation, annee } = await contexteInscription(id);
    const versements = (await col.versements().where('inscriptionId', '==', id).get()).docs
        .map((doc) => doc.data())
        .sort((a, b) => String(a.dateVersement).localeCompare(String(b.dateVersement)));
    const echeances = [...(inscription.echeances ?? [])].sort((a: Doc, b: Doc) => String(a.dateEcheance).localeCompare(String(b.dateEcheance)));
    const montantNet = Math.max(0, Number(inscription.montantDu ?? 0) - Number(inscription.montantRemise ?? 0));
    const montantEncaisse = versements
        .filter((v) => v.statut === 'Validée')
        .reduce((total, v) => total + Number(v.montant ?? 0), 0);
    const solde = Math.max(0, montantNet - montantEncaisse);
    const reference = `FACT-${inscription.id.toUpperCase()}`;
    const lignesVersements = versements.length
        ? versements.map((v) => [
              dateFr(String(v.dateVersement)),
              v.numeroRecu ?? '—',
              v.statut,
              `${formaterMontant(v.montant)} MRU`,
          ])
        : [[{ text: 'Aucun versement enregistré.', colSpan: 4, alignment: 'center' }, '', '', '']];
    const contenu = [
        ...entete(),
        titre('Facture d’inscription'),
        encadre([
            { text: reference, fontSize: 14, bold: true, color: BLEU },
            `Émise le ${jourFr(new Date())}`,
            `Année académique : ${annee.libelle}`,
        ]),
        grille([
            [cle('Étudiant'), `${maj(etudiant.nom)} ${etudiant.prenom}`],
            [cle('E-mail'), etudiant.email ?? 'Non renseigné'],
            [cle('Formation'), `${formation.code} · ${formation.libelle}`],
            [cle('Inscription'), inscription.id],
        ]),
        grille([
            ['Frais de formation', `${formaterMontant(inscription.montantDu ?? 0)} MRU`],
            ['Remise', `− ${formaterMontant(inscription.montantRemise ?? 0)} MRU`],
            [{ text: 'Montant net dû', bold: true }, { text: `${formaterMontant(montantNet)} MRU`, bold: true }],
        ], ['Désignation', 'Montant']),
        { text: 'Échéancier', fontSize: 13, bold: true, color: BLEU, margin: [0, 15, 0, 0] },
        grille(
            echeances.length
                ? echeances.map((e: Doc) => [String(e.libelle ?? 'Échéance'), dateFr(String(e.dateEcheance)), `${formaterMontant(e.montant ?? 0)} MRU`])
                : [[{ text: 'Aucune échéance définie.', colSpan: 3, alignment: 'center' }, '', '']],
            ['Échéance', 'Date limite', 'Montant'],
        ),
        { text: 'Versements enregistrés', fontSize: 13, bold: true, color: BLEU, margin: [0, 15, 0, 0] },
        grille(lignesVersements, ['Date', 'Reçu', 'Statut', 'Montant']),
        {
            text: [
                { text: 'Total encaissé (versements validés) : ', bold: true },
                `${formaterMontant(montantEncaisse)} MRU`,
                '\n',
                { text: 'Solde restant : ', bold: true, color: BLEU },
                { text: `${formaterMontant(solde)} MRU`, bold: true, color: BLEU },
            ],
            alignment: 'right',
            margin: [0, 15, 0, 0],
        },
        { text: 'Document généré à partir du dossier financier de l’INSEC.', fontSize: 9, color: '#666666', margin: [0, 20, 0, 0] },
    ];
    return {
        nom: `facture-inscription-${id}.pdf`,
        contenu: await document(contenu, `Facture ${reference} · INSEC Dashboard`),
    };
}

const generateurs = { attestation, releve, convocation, recu, facture };

export const genererPdf = operation(
    'genererPdf',
    ROLES_ADMIN,
    async (donnees) => {
        const v = valider(z.object({ type: s.choix(['attestation', 'releve', 'convocation', 'recu', 'facture'] as const), id: s.id() }), donnees);
        return generateurs[v.type](v.id);
    },
    { memory: '512MiB' },
);

async function destinataireDocument(type: 'facture' | 'recu' | 'convocation', id: string) {
    let inscriptionId = id;
    let etudiantId: string | null = null;

    if (type === 'recu') {
        const versement = await exiger(null, col.versements().doc(id), 'Versement introuvable.');
        if (versement.statut !== 'Validée') {
            throw new HttpsError('failed-precondition', 'Seul un versement validé peut être envoyé comme reçu.');
        }
        inscriptionId = versement.inscriptionId;
        etudiantId = versement.etudiantId;
    } else if (type === 'convocation') {
        const resultat = await exiger(null, col.resultats().doc(id), 'Convocation introuvable.');
        if (resultat.statutExamen === 'Annulé') {
            throw new HttpsError('failed-precondition', 'Une convocation ne peut pas être envoyée pour un examen annulé.');
        }
        inscriptionId = resultat.inscriptionId;
        etudiantId = resultat.etudiantId;
    }

    const contexte = await contexteInscription(inscriptionId);
    if (etudiantId && etudiantId !== contexte.inscription.etudiantId) {
        throw new HttpsError('failed-precondition', 'Le document et l’inscription ne correspondent pas au même étudiant.');
    }
    const email = String(contexte.etudiant.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('failed-precondition', 'Aucune adresse e-mail valide n’est enregistrée pour cet étudiant.');
    }
    return { ...contexte, email };
}

export const envoyerDocumentParEmail = operation(
    'envoyerDocumentParEmail',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const v = valider(z.object({ type: s.choix(['facture', 'recu', 'convocation'] as const), id: s.id() }), donnees);
        const contexte = await destinataireDocument(v.type, v.id);
        const pdf = await generateurs[v.type](v.id);
        const contenu = Buffer.from(pdf.contenu, 'base64');
        if (contenu.length > 8 * 1024 * 1024) {
            throw new HttpsError('resource-exhausted', 'Le document dépasse la taille maximale autorisée pour un e-mail.');
        }

        const libelles = { facture: 'Facture d’inscription', recu: 'Reçu de paiement', convocation: 'Convocation à l’examen' };
        const libelle = libelles[v.type];
        const email: Email = {
            destinataire: contexte.email,
            nomDestinataire: `${contexte.etudiant.prenom ?? ''} ${contexte.etudiant.nom ?? ''}`.trim() || null,
            type: 'Document PDF',
            sujet: `INSEC · ${libelle}`,
            titre: libelle,
            message: 'Veuillez trouver votre document en pièce jointe. Pour toute question, contactez le secrétariat de l’INSEC.',
            details: { Document: pdf.nom, 'Année académique': String(contexte.annee.libelle ?? '') },
        };
        const journal = db.collection('journalEmails').doc();
        await journal.set({
            ...email,
            lien: null,
            libelleLien: null,
            etudiantId: contexte.inscription.etudiantId,
            nomPieceJointe: pdf.nom,
            acteurId: acteur.uid,
            statut: 'En attente',
            envoiDirect: true,
            erreur: null,
            envoyeLe: null,
            creeLe: FieldValue.serverTimestamp(),
        });

        const statut = await expedier(journal.id, email, transportSmtp(), [
            { filename: pdf.nom, content: contenu, contentType: 'application/pdf' },
        ]);
        if (statut === 'Échec') {
            throw new HttpsError('unavailable', 'Le document n’a pas pu être envoyé. Consultez le journal des communications.');
        }
        return { message: `${libelle} envoyé à ${contexte.email}.` };
    },
    { memory: '512MiB', timeoutSeconds: 120, secrets: [SMTP_PASSWORD] },
);
