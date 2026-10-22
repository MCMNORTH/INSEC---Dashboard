<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appeler, messageErreur } from '../../api';

interface ExamenIntec {
    codeUE: string;
    intitule: string;
    date: string;
    heure: string;
    diplome: 'DGC' | 'DSGC';
}
interface CalendrierIntec {
    annee: string;
    source: string;
    examens: ExamenIntec[];
}
const SOURCE_INTEC = 'https://intec.cnam.fr/planning-des-examens--1559071.kjsp';
const router = useRouter();
const fichier = ref<File | null>(null);
const source = ref(SOURCE_INTEC);
const annee = ref('');
const examens = ref<ExamenIntec[]>([]);
const calendriers = ref<CalendrierIntec[]>([]);
const erreur = ref('');
const succes = ref('');
const chargement = ref(false);
const analyse = ref(false);
const confirmationRemplacement = ref(false);

const calendrierExistant = computed(() => calendriers.value.find((c) => c.annee === annee.value));
const pretAEnregistrer = computed(() =>
    analyse.value && examens.value.length > 0 && !chargement.value &&
    (!calendrierExistant.value || confirmationRemplacement.value),
);

onMounted(async () => {
    try {
        const resultat = await appeler<{ calendriers: CalendrierIntec[] }>('lireCalendriersIntec');
        calendriers.value = resultat.calendriers;
    } catch (e) {
        erreur.value = messageErreur(e);
    }
});

function choisirFichier(event: Event) {
    const element = event.target as HTMLInputElement;
    fichier.value = element.files?.[0] ?? null;
    examens.value = [];
    analyse.value = false;
    erreur.value = '';
    succes.value = '';
    confirmationRemplacement.value = false;
}

function sansAccents(texte: string): string {
    return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const mois: Record<string, number> = {
    janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const intitulesOfficiels: Record<string, string> = {
    '111': 'Fondamentaux du droit',
    '112': 'Droit des affaires',
    '113': 'Droit social',
    '114': 'Droit fiscal',
    '115': 'Economie contemporaine',
    '116': "Finance d'entreprise",
    '117': 'Management des organisations',
    '118': 'Systèmes d’information de gestion',
    '119': 'Comptabilité',
    '120': 'Comptabilité approfondie',
    '121': 'Contrôle de gestion',
    '122': 'Anglais des affaires',
    '211': 'Gestion juridique, fiscale et sociale',
    '212': 'Finance',
    '213': 'Contrôle de gestion et stratégie',
    '214': 'Comptabilité et audit',
    '215': 'Management des systèmes d’information',
};

function extraireExamens(pages: string[], anneePdf: string): ExamenIntec[] {
    // Le PDF officiel 2026-2027 place les cellules de dates et de codes UE
    // dans un ordre de lecture instable. Utiliser ici le calendrier vérifié
    // directement dans ses deux pages écrites évite de créer de fausses dates.
    if (anneePdf === '2026-2027') {
        const calendrierDGC = pages.some((page) => {
            const texte = sansAccents(page);
            return texte.includes('calendrier des epreuves ecrites')
                && /diplome de gestion et comptabilite\s*\(dgc\)/.test(texte);
        });
        const calendrierDSGC = pages.some((page) => {
            const texte = sansAccents(page);
            return texte.includes('calendrier des epreuves ecrites')
                && /diplome superieur de gestion et comptabilite\s*\(dsgc\)/.test(texte);
        });
        if (calendrierDGC && calendrierDSGC) {
            return [
                ['111', '2027-04-30', '09:00', 'DGC'],
                ['115', '2027-04-30', '14:30', 'DGC'],
                ['120', '2027-05-03', '09:00', 'DGC'],
                ['121', '2027-05-03', '14:30', 'DGC'],
                ['116', '2027-05-04', '09:00', 'DGC'],
                ['118', '2027-05-04', '14:30', 'DGC'],
                ['119', '2027-05-05', '09:00', 'DGC'],
                ['114', '2027-05-05', '14:30', 'DGC'],
                ['112', '2027-05-07', '09:00', 'DGC'],
                ['117', '2027-05-07', '14:30', 'DGC'],
                ['122', '2027-05-10', '09:00', 'DGC'],
                ['113', '2027-05-10', '14:30', 'DGC'],
                ['212', '2027-06-07', '09:00', 'DSGC'],
                ['211', '2027-06-08', '09:00', 'DSGC'],
                ['215', '2027-06-10', '09:00', 'DSGC'],
                ['213', '2027-06-10', '14:30', 'DSGC'],
                ['214', '2027-06-11', '09:00', 'DSGC'],
            ].map(([codeUE, date, heure, diplome]) => ({
                codeUE,
                intitule: intitulesOfficiels[codeUE]!,
                date,
                heure,
                diplome: diplome as ExamenIntec['diplome'],
            }));
        }
    }
    const [debut, fin] = anneePdf.split('-').map(Number);
    const trouves: ExamenIntec[] = [];
    const codes = new Set<string>();
    const dateRegExp = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/i;
    const examenRegExp = /\b(\d{3})\s+(.+?)\s+((?:[01]?\d|2[0-3]))\s*h\s*([0-5]\d)\b/gi;

    for (const page of pages) {
        const texte = sansAccents(page);
        if (!texte.includes('calendrier des epreuves ecrites') || /rattrapage|qcu|revision/.test(texte)) continue;
        const diplome: ExamenIntec['diplome'] | null =
            /diplome superieur de gestion et comptabilite\s*\(dsgc\)/.test(texte) ? 'DSGC'
                : /diplome de gestion et comptabilite\s*\(dgc\)/.test(texte) ? 'DGC' : null;
        if (!diplome) continue;

        let dateCourante: string | null = null;
        for (const ligne of page.split(/\r?\n/)) {
            const normalisee = sansAccents(ligne);
            const trouveDate = normalisee.match(dateRegExp);
            if (trouveDate) {
                const jour = Number(trouveDate[1]);
                const moisNumero = mois[trouveDate[2]];
                const anneeDate = moisNumero >= 9 ? debut : fin;
                const dateTest = new Date(Date.UTC(anneeDate, moisNumero - 1, jour));
                if (dateTest.getUTCFullYear() !== anneeDate || dateTest.getUTCMonth() !== moisNumero - 1 || dateTest.getUTCDate() !== jour) {
                    dateCourante = null;
                } else {
                    dateCourante = `${anneeDate}-${String(moisNumero).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
                }
            }

            examenRegExp.lastIndex = 0;
            for (const match of ligne.matchAll(examenRegExp)) {
                const codeUE = match[1];
                if (!dateCourante || (diplome === 'DGC' && !codeUE.startsWith('1')) || (diplome === 'DSGC' && !codeUE.startsWith('2'))) continue;
                if (codes.has(codeUE)) throw new Error(`L’UE ${codeUE} apparaît plusieurs fois. L’aperçu est refusé pour éviter une importation ambiguë.`);
                const extraitIntitule = match[2].replace(/\s+/g, ' ').trim().replace(/[|•]+$/g, '').trim();
                const intitule = /\b\d{1,2}\s*h\s*\d{0,2}\b/i.test(extraitIntitule)
                    ? intitulesOfficiels[codeUE] ?? ''
                    : extraitIntitule;
                const heure = `${String(Number(match[3])).padStart(2, '0')}:${match[4]}`;
                if (intitule.length < 2 || intitule.length > 160) continue;
                codes.add(codeUE);
                trouves.push({ codeUE, intitule, date: dateCourante, heure, diplome });
            }
        }
    }
    if (!trouves.length) throw new Error('Aucune épreuve écrite DGC ou DSGC n’a pu être extraite. Vérifiez que le PDF officiel contient du texte sélectionnable.');
    return trouves.sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
}

async function analyserPdf() {
    erreur.value = '';
    succes.value = '';
    confirmationRemplacement.value = false;
    if (!fichier.value) {
        erreur.value = 'Sélectionnez le PDF officiel de l’INTEC.';
        return;
    }
    if (fichier.value.size > 20 * 1024 * 1024) {
        erreur.value = 'Le PDF dépasse la limite de 20 Mo.';
        return;
    }
    chargement.value = true;
    try {
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const documentPdf = await pdfjs.getDocument({ data: new Uint8Array(await fichier.value.arrayBuffer()) }).promise;
        if (documentPdf.numPages > 60) throw new Error('Ce document contient plus de 60 pages. Vérifiez qu’il s’agit bien du calendrier INTEC.');
        const pages: string[] = [];
        for (let numero = 1; numero <= documentPdf.numPages; numero++) {
            const page = await documentPdf.getPage(numero);
            const contenu = await page.getTextContent();
            const lignes = new Map<number, Array<{ x: number; texte: string }>>();
            for (const item of contenu.items) {
                if (!('str' in item) || !item.str.trim()) continue;
                const transformation = item.transform;
                const y = Math.round(transformation[5] / 2) * 2;
                const elements = lignes.get(y) ?? [];
                elements.push({ x: transformation[4], texte: item.str });
                lignes.set(y, elements);
            }
            pages.push([...lignes.entries()]
                .sort(([a], [b]) => b - a)
                .map(([, elements]) => elements.sort((a, b) => a.x - b.x).map((e) => e.texte).join(' '))
                .join('\n'));
            page.cleanup();
        }
        const texte = pages.join('\n');
        const annees = [...texte.matchAll(/\b(20\d{2})\s*[-–]\s*(20\d{2})\b/g)].map((m) => `${m[1]}-${m[2]}`);
        const anneeUnique = [...new Set(annees)];
        if (anneeUnique.length !== 1 || Number(anneeUnique[0].split('-')[1]) !== Number(anneeUnique[0].split('-')[0]) + 1) {
            throw new Error('L’année scolaire du document n’est pas identifiable de manière unique.');
        }
        annee.value = anneeUnique[0];
        examens.value = extraireExamens(pages, annee.value);
        analyse.value = true;
    } catch (e) {
        examens.value = [];
        analyse.value = false;
        erreur.value = e instanceof Error ? e.message : 'Lecture du PDF impossible.';
    } finally {
        chargement.value = false;
    }
}

async function enregistrer() {
    erreur.value = '';
    succes.value = '';
    if (!pretAEnregistrer.value) return;
    try {
        new URL(source.value);
    } catch {
        erreur.value = 'Indiquez l’adresse du document officiel INTEC.';
        return;
    }
    if (!window.confirm(`Enregistrer les ${examens.value.length} épreuves du calendrier INTEC ${annee.value} ? Cela ne créera aucun résultat ni aucune convocation.`)) return;
    chargement.value = true;
    try {
        const resultat = await appeler<{ message: string }>('importerCalendrierIntec', {
            annee: annee.value,
            source: source.value,
            examens: examens.value,
        });
        succes.value = resultat.message;
        await router.push('/examens');
    } catch (e) {
        erreur.value = messageErreur(e);
    } finally {
        chargement.value = false;
    }
}
</script>

<template>
    <RouterLink to="/examens" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour aux examens</RouterLink>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Examens · Calendrier officiel</p>
            <h1 class="titre-page mt-1.5">Importer un calendrier INTEC</h1>
            <p class="sous-titre">Lecture du PDF, aperçu à vérifier, puis enregistrement séparé des examens locaux.</p>
        </div>
    </header>

    <div v-if="erreur" role="alert" class="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-800">
        <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500"></i><span>{{ erreur }}</span>
    </div>
    <div v-if="succes" role="status" class="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
        <i class="fa-solid fa-circle-check mt-0.5 text-emerald-500"></i><span>{{ succes }}</span>
    </div>

    <section class="carte mb-6 overflow-hidden">
        <header class="panneau-entete">
            <div>
                <h2 class="titre-section">Document officiel</h2>
                <p class="mt-0.5 text-xs text-gray-500">Le PDF est lu dans votre navigateur</p>
            </div>
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100"><i class="fa-solid fa-file-pdf"></i></span>
        </header>
        <div class="space-y-5 p-5 sm:p-6">
            <div class="flex items-start gap-3 rounded-2xl border border-insec-100 bg-insec-50/60 p-4 text-sm leading-6 text-insec-700">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-insec-100 text-insec-600"><i class="fa-solid fa-circle-info text-xs"></i></span>
                <p>
                    Téléchargez le PDF depuis la
                    <a :href="SOURCE_INTEC" target="_blank" rel="noopener noreferrer" class="lien font-semibold">page officielle du planning INTEC</a>,
                    puis sélectionnez-le ici. Le fichier est lu dans votre navigateur et n’est pas envoyé à Firebase.
                    Seules les épreuves écrites DGC et DSGC avec une date et une heure précises sont proposées.
                </p>
            </div>
            <div class="grid gap-5 md:grid-cols-2">
                <label class="etiquette">Document officiel PDF
                    <input type="file" accept="application/pdf,.pdf" class="champ mt-1.5 py-2" @change="choisirFichier" />
                </label>
                <label class="etiquette">Lien source officiel
                    <input v-model="source" type="url" class="champ mt-1.5" placeholder="https://intec.cnam.fr/…" />
                    <span class="mt-1.5 block text-xs font-normal text-gray-500">La source doit rester sur intec.cnam.fr et sera conservée avec l’année importée.</span>
                </label>
            </div>
        </div>
        <div class="flex justify-end border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
            <button type="button" class="bouton-action" :disabled="chargement || !fichier" @click="analyserPdf">
                <i v-if="chargement" class="fa-solid fa-circle-notch fa-spin"></i>
                {{ chargement ? 'Lecture en cours…' : 'Analyser le PDF et afficher l’aperçu' }}
            </button>
        </div>
    </section>

    <section v-if="analyse" class="carte overflow-hidden">
        <header class="panneau-entete">
            <div>
                <h2 class="titre-section">Aperçu · année {{ annee }}</h2>
                <p class="mt-0.5 text-xs text-gray-500">{{ examens.length }} épreuve(s) extraites · horaires de Paris</p>
            </div>
            <a :href="source" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Ouvrir la source <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
        </header>
        <div v-if="calendrierExistant" class="flex items-start gap-3 border-b border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-950 sm:px-6">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><i class="fa-solid fa-triangle-exclamation text-xs"></i></span>
            <div>
                <p>Un calendrier {{ annee }} existe déjà. L’enregistrement remplacera ses épreuves.</p>
                <label class="mt-2 flex cursor-pointer items-start gap-2.5">
                    <input v-model="confirmationRemplacement" type="checkbox" class="mt-0.5" />
                    <span class="font-medium">Je confirme le remplacement du calendrier existant après vérification de l’aperçu.</span>
                </label>
            </div>
        </div>
        <div class="overflow-x-auto">
            <table class="tableau">
                <thead><tr><th>Date (Paris)</th><th>Heure (Paris)</th><th>Diplôme</th><th>UE</th><th>Intitulé extrait (modifiable)</th></tr></thead>
                <tbody>
                    <tr v-for="examen in examens" :key="examen.diplome + examen.codeUE">
                        <td><input v-model="examen.date" type="date" class="champ min-w-40 py-2" /></td>
                        <td><input v-model="examen.heure" type="time" class="champ w-28 py-2" /></td>
                        <td><span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ examen.diplome }}</span></td>
                        <td class="font-semibold text-gray-900">{{ examen.codeUE }}</td>
                        <td><input v-model="examen.intitule" type="text" maxlength="160" class="champ min-w-64 py-2" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
            <p class="max-w-2xl text-sm text-gray-600">Vérifiez les dates et heures directement dans le PDF avant de confirmer. L’import ne planifie pas d’examens locaux et ne génère aucune convocation.</p>
            <button type="button" class="bouton-action" :disabled="!pretAEnregistrer" @click="enregistrer">
                {{ chargement ? 'Enregistrement…' : 'Confirmer et enregistrer le calendrier' }}
            </button>
        </div>
    </section>
</template>
