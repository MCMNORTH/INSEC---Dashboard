import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import pdfmake from 'pdfmake';
import { operation } from '../lib/contexte.js';
import { col, exiger, type Doc } from '../lib/donnees.js';
import { db, FUSEAU } from '../lib/firebase.js';
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

const generateurs = { attestation, releve, convocation, recu };

export const genererPdf = operation(
    'genererPdf',
    ROLES_ADMIN,
    async (donnees) => {
        const v = valider(z.object({ type: s.choix(['attestation', 'releve', 'convocation', 'recu'] as const), id: s.id() }), donnees);
        return generateurs[v.type](v.id);
    },
    { memory: '512MiB' },
);
