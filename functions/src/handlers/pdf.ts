import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import pdfmake from 'pdfmake';
import { HttpsError } from 'firebase-functions/v2/https';
import { operation } from '../lib/contexte.js';
import { col, exiger, type Doc } from '../lib/donnees.js';
import { db, FieldValue, FUSEAU } from '../lib/firebase.js';
import { expedier, SMTP_PASSWORD, transportSmtp, type Email } from '../lib/email.js';
import { s, valider, z } from '../lib/validation.js';
import { etatEcheances, formaterMontant, horaireExamen, montantNet, numeroFormate, resultatValide, ROLES_ADMIN, soldeRestant, statutPaiement } from '../shared/domaine.js';
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

async function document(
    contenu: unknown[],
    piedDePage: string | ((page: number, pages: number) => unknown),
    orientation: 'portrait' | 'landscape' = 'portrait',
    options: Record<string, unknown> = {},
): Promise<string> {
    const buffer = await pdfmake
        .createPdf({
            pageOrientation: orientation,
            pageMargins: [40, 50, 40, 60],
            defaultStyle: { font: 'Roboto', fontSize: 10, color: '#202020' },
            content: contenu,
            footer: typeof piedDePage === 'string' ? { text: piedDePage, fontSize: 8, color: '#777777', margin: [40, 20, 40, 0] } : piedDePage,
            ...options,
        })
        .getBuffer();
    return buffer.toString('base64');
}

// Logo officiel (rogné, 600 px), lu une fois et intégré en data URL : aucun accès réseau ni disque par pdfmake.
const LOGO = `data:image/png;base64,${readFileSync(new URL('../../assets/logo-insec.png', import.meta.url)).toString('base64')}`;
// Cachet et signature de l’INSEC (fond transparent), apposés au bas des factures.
const CACHET = `data:image/png;base64,${readFileSync(new URL('../../assets/cachet-signature-insec.png', import.meta.url)).toString('base64')}`;
const MARINE = '#002057';
const ROUGE = '#d90014';
const GRIS = '#6b7280';
const FILET = '#e5e7eb';

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
            [cle('Date et heure'), horaireExamen(resultat.dateExamen.toDate())],
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

const COULEURS_STATUT: Record<string, string> = {
    Soldé: '#047857',
    Partiel: '#b45309',
    Impayé: ROUGE,
    'À chiffrer': GRIS,
    'Pris en charge BUMEX': MARINE,
    Annulée: GRIS,
};
const VERT = '#047857';
const COULEURS_ECHEANCE: Record<string, string> = { Payée: VERT, Partielle: '#b45309', 'En retard': ROUGE, 'À venir': GRIS };
const mru = (valeur: number) => `${formaterMontant(valeur)} MRU`;
const etiquette = (texte: string) => ({ text: maj(texte), fontSize: 7.5, bold: true, color: GRIS, characterSpacing: 1, margin: [0, 0, 0, 4] });
const sousTitre = (texte: string) => ({ text: texte, fontSize: 11, bold: true, color: MARINE, margin: [0, 18, 0, 4] });
const aDroite = (cellule: unknown) => ({ ...(typeof cellule === 'object' && cellule ? cellule : { text: cellule }), alignment: 'right' });
// Référence courte et lisible de la facture : année de début + 8 premiers caractères de l’inscription.
const referenceFacture = (inscription: Doc) => `FAC-${String(inscription.anneeId ?? '').slice(0, 4)}-${String(inscription.id).slice(0, 8).toUpperCase()}`;

// Tableau épuré : en-tête discret souligné en marine, filets horizontaux fins, aucun trait vertical.
function tableauEpure(entetes: string[], lignes: unknown[][], largeurs: (string | number)[]) {
    const derniere = largeurs.length - 1;
    return {
        table: {
            headerRows: 1,
            widths: largeurs,
            body: [
                entetes.map((e, i) => ({ ...etiquette(e), margin: [0, 0, 0, 0], ...(i === derniere ? { alignment: 'right' } : {}) })),
                ...lignes.map((ligne) => ligne.map((cellule, i) => (i === derniere ? aDroite(cellule) : cellule))),
            ],
        },
        layout: {
            hLineWidth: (i: number) => (i === 0 ? 0 : i === 1 ? 1 : 0.5),
            hLineColor: (i: number) => (i === 1 ? MARINE : FILET),
            vLineWidth: () => 0,
            paddingLeft: (i: number) => (i === 0 ? 0 : 10),
            paddingRight: () => 0,
            paddingTop: () => 8,
            paddingBottom: () => 8,
        },
    };
}

// En-tête commun aux documents financiers : logo, titre espacé, référence et pastille de statut.
function enteteFinancier(titreDocument: string, reference: string, statut: string, couleurStatut: string) {
    return [
        {
            columns: [
                { image: LOGO, width: 118 },
                {
                    width: '*',
                    alignment: 'right',
                    stack: [
                        { text: maj(titreDocument), fontSize: 24, bold: true, color: MARINE, characterSpacing: 4 },
                        { text: reference, fontSize: 10, color: GRIS, margin: [0, 4, 0, 10] },
                        {
                            columns: [
                                { width: '*', text: '' },
                                {
                                    width: 'auto',
                                    table: { body: [[{ text: maj(statut), fontSize: 7.5, bold: true, color: 'white', characterSpacing: 1, fillColor: couleurStatut, margin: [6, 2, 6, 1] }]] },
                                    layout: 'noBorders',
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: FILET }], margin: [0, 18, 0, 14] },
    ];
}

// Trois colonnes : destinataire, dates, émetteur (INSEC).
function partiesFinancieres(libelleDestinataire: string, etudiant: Doc, inscription: Doc, dates: [string, string][]) {
    return {
        columns: [
            {
                width: '*',
                stack: [
                    etiquette(libelleDestinataire),
                    { text: `${maj(etudiant.nom)} ${etudiant.prenom}`, bold: true, fontSize: 11 },
                    { text: etudiant.email ?? 'E-mail non renseigné', color: GRIS, margin: [0, 2, 0, 0] },
                    { text: `N° INTEC : ${inscription.numeroIntec ?? 'non renseigné'}`, color: GRIS, margin: [0, 2, 0, 0] },
                ],
            },
            {
                width: 'auto',
                stack: dates.flatMap(([libelle, valeur], i) => [etiquette(libelle), { text: valeur, margin: [0, 0, 0, i < dates.length - 1 ? 10 : 0] }]),
            },
            {
                width: 185,
                alignment: 'right',
                stack: [
                    etiquette('Émetteur'),
                    { text: 'INSEC', bold: true },
                    { text: 'Centre associé de l’INTEC – CNAM Paris', color: GRIS, margin: [0, 2, 0, 0] },
                    { text: 'Nouakchott, Mauritanie', color: GRIS, margin: [0, 2, 0, 0] },
                ],
            },
        ],
        columnGap: 24,
        margin: [0, 0, 0, 24],
    };
}

// Encadré de totaux aligné à droite ; la dernière ligne est mise en valeur sur fond marine.
function totauxFinanciers(lignes: [string, string][], final: [string, string]) {
    return {
        columns: [
            { width: '*', text: '' },
            {
                width: 240,
                table: {
                    widths: ['*', 'auto'],
                    body: [
                        ...lignes.map(([libelle, valeur], i) => [
                            { text: libelle, color: GRIS, margin: [10, 0, 0, i === lignes.length - 1 ? 4 : 0] },
                            { text: valeur, alignment: 'right', margin: [0, 0, 10, i === lignes.length - 1 ? 4 : 0] },
                        ]),
                        [
                            {
                                colSpan: 2,
                                fillColor: MARINE,
                                margin: [10, 6, 10, 6],
                                columns: [
                                    { text: final[0], bold: true, color: 'white', margin: [0, 3, 0, 0] },
                                    { text: final[1], bold: true, fontSize: 14, color: 'white', alignment: 'right', width: 'auto' },
                                ],
                            },
                            '',
                        ],
                    ],
                },
                layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
            },
        ],
        margin: [0, 12, 0, 0],
    };
}

// Mention finale à gauche, cachet et signature de l’INSEC à droite (jamais coupés entre deux pages).
function blocCachet(mention: string) {
    return {
        columns: [
            { width: '*', text: mention, fontSize: 8.5, color: GRIS, margin: [0, 30, 24, 0] },
            {
                width: 130,
                stack: [
                    { ...etiquette('Cachet et signature'), alignment: 'center' },
                    { image: CACHET, width: 120, alignment: 'center', margin: [0, 2, 0, 0] },
                ],
            },
        ],
        unbreakable: true,
        margin: [0, 14, 0, 0],
    };
}

// Mise en page commune : filet d’accent aux couleurs du logo (marine puis rouge) et pied de page paginé.
function documentFinancier(contenu: unknown[], reference: string, titreDocument: string) {
    const pied = (page: number, pages: number) => ({
        columns: [
            { text: 'INSEC · Centre associé de l’INTEC – CNAM Paris · Nouakchott, Mauritanie', fontSize: 7.5, color: GRIS },
            { text: `${reference} · ${page}/${pages}`, fontSize: 7.5, color: GRIS, alignment: 'right', width: 'auto' },
        ],
        margin: [48, 24, 48, 0],
    });
    const bandeau = () => ({
        canvas: [
            { type: 'rect', x: 0, y: 0, w: 430, h: 5, color: MARINE },
            { type: 'rect', x: 430, y: 0, w: 166, h: 5, color: ROUGE },
        ],
    });
    return document(contenu, pied, 'portrait', {
        pageSize: 'A4',
        pageMargins: [48, 56, 48, 64],
        defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#111827', lineHeight: 1.15 },
        background: bandeau,
        info: { title: `${titreDocument} ${reference}`, author: 'INSEC' },
    });
}

async function recu(id: string) {
    const versement = await exiger(null, col.versements().doc(id), 'Versement introuvable.');
    if (versement.statut !== 'Validée') {
        throw new HttpsError('failed-precondition', 'Un reçu officiel ne peut être généré qu’après validation du versement.');
    }
    const { inscription, etudiant, formation, annee } = await contexteInscription(versement.inscriptionId);
    const valides = (await col.versements().where('inscriptionId', '==', versement.inscriptionId).get()).docs
        .map((doc) => doc.data())
        .filter((v) => v.statut === 'Validée');
    const totalVerse = valides.reduce((total, v) => total + Number(v.montant ?? 0), 0);
    const situation = { ...inscription, totalVerse } as never;
    const reference = versement.numeroRecu ?? 'Reçu provisoire';

    // Montant reçu, mis en avant dans un encadré teinté.
    const montantRecu = {
        table: {
            widths: ['*'],
            body: [[{
                fillColor: '#f3f6fb',
                margin: [16, 14, 16, 14],
                columns: [
                    {
                        width: '*',
                        stack: [
                            etiquette('Montant reçu'),
                            { text: mru(versement.montant), fontSize: 26, bold: true, color: MARINE, margin: [0, 2, 0, 0] },
                        ],
                    },
                    {
                        width: 'auto',
                        alignment: 'right',
                        stack: [
                            etiquette('Mode de paiement'),
                            { text: versement.modePaiement ?? '—', bold: true, margin: [0, 0, 0, 8] },
                            etiquette('Référence'),
                            { text: versement.reference || '—' },
                        ],
                    },
                ],
            }]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 22],
    };

    const contenu = [
        ...enteteFinancier('Reçu', reference, 'Payé', VERT),
        partiesFinancieres('Reçu de', etudiant, inscription, [
            ['Date du paiement', dateFr(String(versement.dateVersement))],
            ['Année académique', String(annee.libelle)],
        ]),
        montantRecu,
        tableauEpure(['Désignation', 'Montant'], [[
            {
                stack: [
                    { text: `Versement · frais de formation ${formation.code}`, bold: true },
                    { text: `${formation.libelle} · année ${annee.libelle}`, fontSize: 8.5, color: GRIS, margin: [0, 2, 0, 0] },
                    { text: `Facture associée : ${referenceFacture(inscription)}`, fontSize: 8.5, color: GRIS, margin: [0, 1, 0, 0] },
                ],
            },
            mru(versement.montant),
        ]], ['*', 110]),
        sousTitre('Situation du dossier'),
        totauxFinanciers(
            [['Total net dû', mru(montantNet(inscription as never))], ['Total versé à ce jour', mru(totalVerse)]],
            ['Reste à payer', mru(soldeRestant(situation))],
        ),
        blocCachet('Ce reçu atteste que le paiement ci-dessus a été reçu et validé par l’INSEC. Conservez-le comme justificatif.'),
    ];
    return {
        nom: `recu-${versement.numeroRecu}.pdf`,
        contenu: await documentFinancier(contenu, reference, 'Reçu'),
    };
}

async function facture(id: string) {
    const { inscription, etudiant, formation, annee } = await contexteInscription(id);
    const versements = (await col.versements().where('inscriptionId', '==', id).get()).docs
        .map((doc) => doc.data())
        .sort((a, b) => String(a.dateVersement).localeCompare(String(b.dateVersement)));
    const ues = inscription.ueIds?.length ? await db.getAll(...inscription.ueIds.map((u: string) => col.ues().doc(u))) : [];
    const net = montantNet(inscription as never);
    const remise = Number(inscription.montantRemise ?? 0);
    const montantEncaisse = versements
        .filter((v) => v.statut === 'Validée')
        .reduce((total, v) => total + Number(v.montant ?? 0), 0);
    const situation = { ...inscription, totalVerse: montantEncaisse } as never;
    const solde = soldeRestant(situation);
    const statut = statutPaiement(situation);
    const echeances = etatEcheances(situation);
    const mentionStatut = statut === 'Pris en charge BUMEX'
        ? 'Frais pris en charge par BUMEX : aucun montant n’est dû par l’étudiant.'
        : statut === 'Annulée'
            ? 'Inscription annulée : aucun montant n’est dû au titre de cette inscription.'
            : null;
    const reference = referenceFacture(inscription);
    const codesUe = ues.map((u) => u.get('code')).filter(Boolean);

    const lignesFacture: unknown[][] = [
        [
            {
                stack: [
                    { text: `Frais de formation · ${formation.code}`, bold: true },
                    { text: `${formation.libelle} · année ${annee.libelle}`, fontSize: 8.5, color: GRIS, margin: [0, 2, 0, 0] },
                    ...(codesUe.length ? [{ text: `${codesUe.length} UE : ${codesUe.join(', ')}`, fontSize: 8.5, color: GRIS, margin: [0, 1, 0, 0] }] : []),
                ],
            },
            mru(inscription.montantDu ?? 0),
        ],
        ...(remise > 0 ? [['Remise accordée', `− ${mru(remise)}`]] : []),
    ];

    const contenu = [
        ...enteteFinancier('Facture', reference, statut, COULEURS_STATUT[statut] ?? GRIS),
        partiesFinancieres('Facturé à', etudiant, inscription, [
            ['Émise le', jourFr(new Date())],
            ['Année académique', String(annee.libelle)],
        ]),
        tableauEpure(['Désignation', 'Montant'], lignesFacture, ['*', 110]),
        totauxFinanciers([['Total net', mru(net)], ['Déjà réglé', `− ${mru(montantEncaisse)}`]], ['Reste à payer', mru(solde)]),
        ...(mentionStatut ? [{ text: mentionStatut, alignment: 'right', color: MARINE, bold: true, fontSize: 9, margin: [0, 8, 0, 0] }] : []),
        ...(echeances.length
            ? [
                  sousTitre('Échéancier'),
                  tableauEpure(
                      ['Échéance', 'Date limite', 'État', 'Montant'],
                      echeances.map((e) => [
                          String(e.libelle || 'Échéance'),
                          dateFr(String(e.dateEcheance)),
                          { text: e.etat, bold: true, color: COULEURS_ECHEANCE[e.etat] ?? GRIS },
                          mru(e.montant ?? 0),
                      ]),
                      ['*', 90, 80, 100],
                  ),
              ]
            : []),
        ...(versements.length
            ? [
                  sousTitre('Versements'),
                  tableauEpure(
                      ['Date', 'Reçu', 'Mode', 'Statut', 'Montant'],
                      versements.map((v) => [
                          dateFr(String(v.dateVersement)),
                          v.numeroRecu ?? '—',
                          v.modePaiement ?? '—',
                          { text: v.statut, color: v.statut === 'Validée' ? VERT : GRIS },
                          mru(v.montant),
                      ]),
                      [70, '*', 80, 70, 100],
                  ),
              ]
            : []),
        blocCachet('Seuls les versements validés sont déduits. Merci de rappeler la référence de la facture lors de chaque règlement.'),
    ];
    return {
        nom: `facture-inscription-${id}.pdf`,
        contenu: await documentFinancier(contenu, reference, 'Facture'),
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
            `Date et heure : ${horaireExamen(examen.dateExamen.toDate())}`,
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
            `Date et heure de l’épreuve : ${horaireExamen(examen.dateExamen.toDate())}`,
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
    let horaire: string | null = null;

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
        horaire = horaireExamen(resultat.dateExamen.toDate());
    }

    const contexte = await contexteInscription(inscriptionId);
    if (type === 'convocation' && contexte.inscription.statut !== 'active') {
        throw new HttpsError('failed-precondition', 'Une convocation ne peut pas être envoyée pour une inscription qui n’est pas active.');
    }
    if (etudiantId && etudiantId !== contexte.inscription.etudiantId) {
        throw new HttpsError('failed-precondition', 'Le document et l’inscription ne correspondent pas au même étudiant.');
    }
    const email = String(contexte.etudiant.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('failed-precondition', 'Aucune adresse e-mail valide n’est enregistrée pour cet étudiant.');
    }
    return { ...contexte, email, horaire };
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
        details: {
            Document: pdf.nom,
            'Année académique': String(contexte.annee.libelle ?? ''),
            ...(contexte.horaire ? { 'Date et heure de l’épreuve': contexte.horaire } : {}),
        },
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
    const resultatInitial = await exiger(null, ref, 'Résultat introuvable.');
    if (resultatInitial.convocationEnvoiStatut !== 'Envoyée' && resultatInitial.convocationEnvoiStatut !== 'En cours') {
        const nomPdf = `convocation-examen-${numeroFormate('CONV', Number(resultatInitial.numeroConvocation ?? 0))}.pdf`;
        const anciensEnvois = await db.collection('journalEmails').where('nomPieceJointe', '==', nomPdf).get();
        const dejaEnvoyee = anciensEnvois.docs.find((document) => document.get('statut') === 'Envoyé');
        if (dejaEnvoyee) {
            await db.runTransaction(async (tx) => {
                const resultat = await exiger(tx, ref, 'Résultat introuvable.');
                if (resultat.convocationEnvoiStatut !== 'Envoyée' && resultat.convocationEnvoiStatut !== 'En cours') {
                    tx.update(ref, {
                        convocationEnvoiStatut: 'Envoyée',
                        convocationEnvoyeeLe: dejaEnvoyee.get('envoyeLe') ?? FieldValue.serverTimestamp(),
                    });
                }
            });
            return 'Déjà envoyée';
        }
    }
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
        const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

    },
    { memory: '1GiB', timeoutSeconds: 300, secrets: [SMTP_PASSWORD] },
);
