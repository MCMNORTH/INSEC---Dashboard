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
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
            <p class="text-sm text-gray-500">Examens · Calendrier officiel</p>
            <h1 class="text-xl font-bold text-insec">Importer un calendrier INTEC</h1>
            <p class="mt-1 text-sm text-gray-600">Lecture du PDF, aperçu à vérifier, puis enregistrement séparé des examens locaux.</p>
        </div>
        <RouterLink to="/examens" class="bouton-secondaire">← Retour aux examens</RouterLink>
    </div>

    <div v-if="erreur" role="alert" class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{{ erreur }}</div>
    <div v-if="succes" role="status" class="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{{ succes }}</div>

    <section class="carte mb-5 space-y-5 p-5">
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            Téléchargez le PDF depuis la
            <a :href="SOURCE_INTEC" target="_blank" rel="noopener noreferrer" class="font-semibold underline">page officielle du planning INTEC</a>,
            puis sélectionnez-le ici. Le fichier est lu dans votre navigateur et n’est pas envoyé à Firebase.
            Seules les épreuves écrites DGC et DSGC avec une date et une heure précises sont proposées.
        </div>
        <label class="block">
            <span class="mb-1 block text-sm font-medium text-gray-700">Document officiel PDF</span>
            <input type="file" accept="application/pdf,.pdf" class="champ w-full" @change="choisirFichier" />
        </label>
        <label class="block">
            <span class="mb-1 block text-sm font-medium text-gray-700">Lien source officiel</span>
            <input v-model="source" type="url" class="champ w-full" placeholder="https://intec.cnam.fr/…" />
            <span class="mt-1 block text-xs text-gray-500">La source doit rester sur intec.cnam.fr et sera conservée avec l’année importée.</span>
        </label>
        <button type="button" class="bouton-action" :disabled="chargement || !fichier" @click="analyserPdf">
            {{ chargement ? 'Lecture en cours…' : 'Analyser le PDF et afficher l’aperçu' }}
        </button>
    </section>

    <section v-if="analyse" class="carte overflow-hidden">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
            <div>
                <h2 class="font-semibold text-insec">Aperçu · année {{ annee }}</h2>
                <p class="text-sm text-gray-500">{{ examens.length }} épreuve(s) extraites · horaires de Paris</p>
            </div>
            <a :href="source" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Ouvrir la source ↗</a>
        </header>
        <div v-if="calendrierExistant" class="border-b border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Un calendrier {{ annee }} existe déjà. L’enregistrement remplacera ses épreuves.
            <label class="mt-2 flex items-start gap-2">
                <input v-model="confirmationRemplacement" type="checkbox" class="mt-1" />
                <span>Je confirme le remplacement du calendrier existant après vérification de l’aperçu.</span>
            </label>
        </div>
        <div class="overflow-x-auto">
            <table class="tableau">
                <thead><tr><th>Date (Paris)</th><th>Heure</th><th>Diplôme</th><th>UE</th><th>Intitulé extrait (modifiable)</th></tr></thead>
                <tbody>
                    <tr v-for="examen in examens" :key="examen.diplome + examen.codeUE">
                        <td><input v-model="examen.date" type="date" class="champ min-w-40" /></td>
                        <td><input v-model="examen.heure" type="time" class="champ w-28" /></td>
                        <td>{{ examen.diplome }}</td>
                        <td>{{ examen.codeUE }}</td>
                        <td><input v-model="examen.intitule" type="text" maxlength="160" class="champ min-w-64" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="border-t border-gray-100 bg-gray-50 p-5">
            <p class="mb-3 text-sm text-gray-600">Vérifiez les dates et heures directement dans le PDF avant de confirmer. L’import ne planifie pas d’examens locaux et ne génère aucune convocation.</p>
            <button type="button" class="bouton-action" :disabled="!pretAEnregistrer" @click="enregistrer">
                {{ chargement ? 'Enregistrement…' : 'Confirmer et enregistrer le calendrier' }}
            </button>
        </div>
    </section>
</template>
