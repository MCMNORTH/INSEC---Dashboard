import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import pdfmake from 'pdfmake';
import { HttpsError } from 'firebase-functions/v2/https';
import { operation } from '../lib/contexte.js';
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

async function document(contenu: unknown[], piedDePage: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<string> {
    const buffer = await pdfmake
        .createPdf({
            pageOrientation: orientation,
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


async function feuillePresence(id: string) {
    const examen = await exiger(null, col.examens().doc(id), 'Examen introuvable.');
    if (examen.statut === 'Annulé') {
        throw new HttpsError('failed-precondition', 'Une feuille de présence ne peut pas être générée pour un examen annulé.');
    }

    const [ueDoc, formationDoc, anneeDoc] = await db.getAll(
        col.ues().doc(examen.ueId),
        col.formations().doc(examen.formationId),
        col.annees().doc(examen.anneeId),
    );
    const ue = ueDoc.data() as Doc;
    const formation = formationDoc.data() as Doc;
    const annee = anneeDoc.data() as Doc;
    const resultats = await col.resultats().where('examenId', '==', id).get();
    const etudiants = resultats.empty
        ? []
        : await db.getAll(...resultats.docs.map((r) => col.etudiants().doc(String(r.get('etudiantId')))));
    const inscriptions = resultats.empty
        ? []
        : await db.getAll(...resultats.docs.map((r) => col.inscriptions().doc(String(r.get('inscriptionId')))));

    const participants = resultats.docs.map((r, index) => {
        const etudiant = etudiants[index]?.data() as Doc | undefined;
        const inscription = inscriptions[index]?.data() as Doc | undefined;
        return {
            nom: `${maj(String(etudiant?.nom ?? 'Dossier incomplet'))} ${String(etudiant?.prenom ?? '')}`.trim(),
            numeroIntec: String(inscription?.numeroIntec ?? '—'),
        };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    const lignes = participants.length
        ? participants.map((p, index) => [
              String(index + 1),
              p.nom,
              p.numeroIntec,
              '',
              '',
          ])
        : [[{ text: 'Aucun étudiant n’est rattaché à cette épreuve.', colSpan: 5, alignment: 'center' }, '', '', '', '']];

    const contenu = [
        ...entete(),
        titre('Feuille de présence'),
        encadre([
            { text: `${ue.code} · ${ue.libelle}`, fontSize: 14, bold: true, color: BLEU },
            `${formation.code} · ${annee.libelle} · Session ${examen.session}`,
            `Date et heure (Paris) : ${formaterDateHeure(examen.dateExamen.toDate())}`,
            `Salle : ${examen.salle || 'À confirmer'} · Effectif convoqué : ${participants.length}`,
        ]),
        {
            table: {
                headerRows: 1,
                widths: [28, '*', 100, 180, 110],
                body: [
                    ['N°', 'Étudiant(e)', 'N° INTEC', 'Signature / émargement', 'Observation'].map((texte) => ({
                        text: texte,
                        color: 'white',
                        fillColor: BLEU,
                        bold: true,
                    })),
                    ...lignes,
                ],
            },
            layout: { hLineColor: '#dddddd', vLineColor: '#dddddd', paddingTop: () => 9, paddingBottom: () => 9 },
            margin: [0, 10, 0, 10],
        },
        { text: 'Nom et signature du surveillant : ______________________________________________', margin: [0, 25, 0, 0] },
    ];

    return {
        nom: `feuille-presence-${ue.code}-${id}.pdf`,
        contenu: await document(contenu, `Feuille de présence · ${formation.code} · ${annee.libelle}`, 'landscape'),
    };
}

async function bordereauCopies(id: string) {
    const examen = await exiger(null, col.examens().doc(id), 'Examen introuvable.');
    if (examen.statut === 'Annulé') {
        throw new HttpsError('failed-precondition', 'Un bordereau ne peut pas être généré pour un examen annulé.');
    }

    const [ueDoc, formationDoc, anneeDoc] = await db.getAll(
        col.ues().doc(examen.ueId),
        col.formations().doc(examen.formationId),
        col.annees().doc(examen.anneeId),
    );
    const ue = ueDoc.data() as Doc;
    const formation = formationDoc.data() as Doc;
    const annee = anneeDoc.data() as Doc;
    const resultats = await col.resultats().where('examenId', '==', id).get();
    const nombre = (presence: string) => resultats.docs.filter((r) => r.get('presence') === presence).length;
    const aPointer = nombre('Convoqué');
    const copies = examen.nombreCopiesRassemblees ?? null;
    const contenu = [
        ...entete(),
        titre('Bordereau d’accompagnement des copies d’examen'),
        { text: 'Destinataire : INTEC-CNAM · Service des examens', bold: true, color: BLEU, margin: [0, 0, 0, 10] },
        encadre([
            { text: `${ue.code} · ${ue.libelle}`, fontSize: 14, bold: true, color: BLEU },
            `${formation.code} · ${annee.libelle} · Session ${examen.session}`,
            `Date et heure de l’épreuve (Paris) : ${formaterDateHeure(examen.dateExamen.toDate())}`,
            `Salle : ${examen.salle || 'À confirmer'}`,
        ]),
        grille([
            [cle('Étudiants convoqués'), String(resultats.size)],
            [cle('Présents'), String(nombre('Présent'))],
            [cle('Absents'), String(nombre('Absent'))],
            [cle('Dispensés'), String(nombre('Dispensé'))],
            [cle('Présences à pointer'), String(aPointer)],
        ]),
        grille([
            [cle('Copies rassemblées'), copies === null ? 'À renseigner dans le suivi' : String(copies)],
            [cle('Date d’envoi (suivi)'), examen.copiesEnvoyeesLe ? dateFr(String(examen.copiesEnvoyeesLe)) : 'À renseigner'],
            [cle('Référence de transport'), examen.referenceEnvoiCopies || 'À renseigner'],
        ]),
        aPointer > 0
            ? { text: `Attention : ${aPointer} présence(s) reste(nt) à pointer. Les totaux de présence ci-dessus reflètent le suivi actuellement enregistré.`, color: '#9a6700', margin: [0, 5, 0, 12] }
            : { text: 'Les totaux ci-dessus reflètent les présences enregistrées dans le dossier de l’épreuve.', color: '#666666', margin: [0, 5, 0, 12] },
        {
            table: {
                widths: ['*', '*'],
                body: [
                    [
                        { text: 'ÉMISSION · INSEC', bold: true, color: 'white', fillColor: BLEU },
                        { text: 'RÉCEPTION · INTEC-CNAM', bold: true, color: 'white', fillColor: BLEU },
                    ],
                    [
                        { text: 'Nom et signature :\n\n\nDate :', margin: [8, 8, 8, 8] },
                        { text: 'Nom et signature :\n\n\nDate de réception :', margin: [8, 8, 8, 8] },
                    ],
                ],
            },
            layout: { hLineColor: '#dddddd', vLineColor: '#dddddd' },
            margin: [0, 15, 0, 0],
        },
    ];

    return {
        nom: `bordereau-copies-${ue.code}-${id}.pdf`,
        contenu: await document(contenu, `Bordereau de retour des copies · ${formation.code} · ${annee.libelle}`),
    };
}

const generateurs = { attestation, releve, convocation, recu, facture, feuillePresence, bordereauCopies };

export const genererPdf = operation(
    'genererPdf',
    ROLES_ADMIN,
    async (donnees) => {
        const v = valider(z.object({ type: s.choix(['attestation', 'releve', 'convocation', 'recu', 'facture', 'feuillePresence', 'bordereauCopies'] as const), id: s.id() }), donnees);
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

async function expedierDocument(
    type: 'facture' | 'recu' | 'convocation',
    id: string,
    acteurId: string,
    transport: ReturnType<typeof transportSmtp>,
) {
    const contexte = await destinataireDocument(type, id);
    const pdf = await generateurs[type](id);
    const contenu = Buffer.from(pdf.contenu, 'base64');
    if (contenu.length > 8 * 1024 * 1024) {
        throw new HttpsError('resource-exhausted', 'Le document dépasse la taille maximale autorisée pour un e-mail.');
    }

    const libelles = { facture: 'Facture d’inscription', recu: 'Reçu de paiement', convocation: 'Convocation à l’examen' };
    const libelle = libelles[type];
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
        acteurId,
        statut: 'En attente',
        envoiDirect: true,
        erreur: null,
        envoyeLe: null,
        creeLe: FieldValue.serverTimestamp(),
    });

    const statut = await expedier(journal.id, email, transport, [
        { filename: pdf.nom, content: contenu, contentType: 'application/pdf' },
    ]);
    return { statut, email, libelle };
}

type StatutConvocation = 'Envoyée' | 'Déjà envoyée' | 'En cours' | 'Échec';

async function envoyerConvocationSuivie(id: string, acteurId: string, transport: ReturnType<typeof transportSmtp>): Promise<StatutConvocation> {
    const ref = col.resultats().doc(id);
    const reservation = await db.runTransaction(async (tx): Promise<'Prise' | 'Déjà envoyée' | 'En cours'> => {
        const resultat = await exiger(tx, ref, 'Résultat introuvable.');
        if (resultat.convocationEnvoiStatut === 'Envoyée') return 'Déjà envoyée';
        if (resultat.convocationEnvoiStatut === 'En cours') return 'En cours';
        tx.update(ref, {
            convocationEnvoiStatut: 'En cours',
            convocationEnvoyeeLe: null,
            convocationEnvoiDemarreeLe: FieldValue.serverTimestamp(),
        });
        return 'Prise';
    });
    if (reservation !== 'Prise') return reservation;

    let resultat: Awaited<ReturnType<typeof expedierDocument>>;
    try {
        resultat = await expedierDocument('convocation', id, acteurId, transport);
    } catch (erreur) {
        await ref.update({ convocationEnvoiStatut: 'Échec', convocationEnvoyeeLe: null });
        throw erreur;
    }

    await ref.update({
        convocationEnvoiStatut: resultat.statut,
        convocationEnvoyeeLe: resultat.statut === 'Envoyé' ? FieldValue.serverTimestamp() : null,
    });
    return resultat.statut === 'Envoyé' ? 'Envoyée' : 'Échec';
}

export const envoyerDocumentParEmail = operation(
    'envoyerDocumentParEmail',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const v = valider(z.object({ type: s.choix(['facture', 'recu', 'convocation'] as const), id: s.id() }), donnees);
        const id = String(v.id ?? '');
        if (!id) throw new HttpsError('invalid-argument', 'Identifiant du document manquant.');
        const acteurId = String(acteur.uid ?? '');
        if (!acteurId) throw new HttpsError('unauthenticated', 'Session administrateur introuvable.');
        if (v.type === 'convocation') {
            const statut = await envoyerConvocationSuivie(id, acteurId, transportSmtp());
            if (statut === 'Échec') {
                throw new HttpsError('unavailable', 'La convocation n’a pas pu être envoyée. Consultez le journal des communications.');
            }
            if (statut === 'Déjà envoyée') return { message: 'Cette convocation a déjà été envoyée ; aucun nouvel e-mail n’a été transmis.' };
            if (statut === 'En cours') return { message: 'L’envoi de cette convocation est déjà en cours.' };
            return { message: 'Convocation envoyée.' };
        }
        const resultat = await expedierDocument(v.type, id, acteurId, transportSmtp());
        if (resultat.statut === 'Échec') {
            throw new HttpsError('unavailable', 'Le document n’a pas pu être envoyé. Consultez le journal des communications.');
        }
        return { message: `${resultat.libelle} envoyé à ${resultat.email.destinataire}.` };
    },
    { memory: '512MiB', timeoutSeconds: 120, secrets: [SMTP_PASSWORD] },
);

export const envoyerConvocationsExamen = operation(
    'envoyerConvocationsExamen',
    ROLES_ADMIN,
    async (donnees, acteur) => {
        const v = valider(z.object({ id: s.id() }), donnees);
        const examenId = String(v.id ?? '');
        if (!examenId) throw new HttpsError('invalid-argument', 'Identifiant de l’examen manquant.');
        const acteurId = String(acteur.uid ?? '');
        if (!acteurId) throw new HttpsError('unauthenticated', 'Session administrateur introuvable.');
        const examen = await exiger(null, col.examens().doc(examenId), 'Examen introuvable.');
        if (examen.statut === 'Annulé') {
            throw new HttpsError('failed-precondition', 'Les convocations d’un examen annulé ne peuvent pas être envoyées.');
        }

        const documents = (await col.resultats().where('examenId', '==', examenId).get()).docs;
        const convoques = documents
            .map((doc) => ({ ...doc.data(), id: doc.id }) as Doc & { id: string; etudiantId: string; presence: string })
            .filter((resultat) => resultat.presence === 'Convoqué');
        const uniques = new Map<string, (typeof convoques)[number]>();
        for (const resultat of convoques) {
            if (typeof resultat.etudiantId === 'string' && resultat.etudiantId && !uniques.has(resultat.etudiantId)) {
                uniques.set(resultat.etudiantId, resultat);
            }
        }
        const cibles = [...uniques.values()];
        if (cibles.length > 300) {
            throw new HttpsError('resource-exhausted', 'Cet envoi dépasse la limite de 300 étudiants par examen.');
        }
        if (!cibles.length) {
            throw new HttpsError('failed-precondition', 'Aucun étudiant n’est marqué « Convoqué » pour cet examen.');
        }

        const dejaEnvoyesInitiaux = cibles.filter((r) => r.convocationEnvoiStatut === 'Envoyée').length;
        const enCoursInitiaux = cibles.filter((r) => r.convocationEnvoiStatut === 'En cours').length;
        const aVerifier = cibles.filter((r) => r.convocationEnvoiStatut !== 'Envoyée' && r.convocationEnvoiStatut !== 'En cours');
        const fiches = aVerifier.length
            ? await db.getAll(...aVerifier.map((resultat) => col.etudiants().doc(resultat.etudiantId)))
            : [];
        const emailValide = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        const eligibles = aVerifier.filter((_, index) => {
            const email = String(fiches[index].get('email') ?? '').trim();
            return fiches[index].exists && emailValide.test(email);
        });
        const sansAdresse = aVerifier.length - eligibles.length;
        const transport = transportSmtp();
        let prochain = 0;
        let envoyes = 0;
        let dejaEnvoyes = dejaEnvoyesInitiaux;
        let enCours = enCoursInitiaux;
        let echecs = 0;
        const travailleurs = Array.from({ length: Math.min(3, eligibles.length) }, async () => {
            while (prochain < eligibles.length) {
                const cible = eligibles[prochain++];
                try {
                    const statut = await envoyerConvocationSuivie(cible.id, acteurId, transport);
                    if (statut === 'Envoyée') envoyes += 1;
                    else if (statut === 'Déjà envoyée') dejaEnvoyes += 1;
                    else if (statut === 'En cours') enCours += 1;
                    else echecs += 1;
                } catch {
                    echecs += 1;
                }
            }
        });
        await Promise.all(travailleurs);

        return {
            message: `Envoi terminé : ${envoyes} envoyé(s), ${dejaEnvoyes} déjà envoyé(s), ${enCours} en cours, ${echecs} échec(s), ${sansAdresse} adresse(s) invalide(s).`,
            envoyes,
            dejaEnvoyes,
            enCours,
            echecs,
            sansAdresse,
        };
        return {
            message: `Envoi terminé : ${envoyes} envoyé(s), ${echecs} échec(s), ${ignores} ignoré(s).`,
            envoyes,
            echecs,
            ignores,
        };
    },
    { memory: '1GiB', timeoutSeconds: 300, secrets: [SMTP_PASSWORD] },
);
