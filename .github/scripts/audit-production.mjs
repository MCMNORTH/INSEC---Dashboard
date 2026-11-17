// Contrôle des vulnérabilités des dépendances de production (gravité « high » ou « critical »).
// Équivaut à `npm audit --omit=dev --audit-level=high`, sauf pour les alertes listées ci-dessous,
// examinées et sans correctif publié. Chaque exception doit être retirée dès qu'un correctif existe.
import { execSync } from 'node:child_process';

const ALERTES_IGNOREES = {
    // picomatch : ReDoS sur des extglobs répétés. Aucune version corrigée (4.0.7 touchée, nov. 2026).
    // Utilisé seulement à la compilation (Vite, plugin de vue-router), jamais dans le site servi.
    'GHSA-fc5q-39xc-vjpf': 'picomatch — ReDoS, outil de compilation uniquement',
};
const GRAVITES_BLOQUANTES = new Set(['high', 'critical']);

let sortie;
try {
    sortie = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
} catch (erreur) {
    // npm audit renvoie un code d'erreur dès qu'une vulnérabilité existe : le JSON est quand même produit.
    sortie = erreur.stdout;
}
const rapport = JSON.parse(sortie);
if (rapport.error) {
    console.error('npm audit a échoué :', rapport.error.summary ?? rapport.error);
    process.exit(1);
}
const vulnerabilites = rapport.vulnerabilities ?? {};
const ghsa = (url) => url?.match(/GHSA-[\w-]+/)?.[0];

// Une vulnérabilité est ignorée si toutes ses causes (alertes directes ou paquets dont elle dépend) sont ignorées.
const memo = new Map();
function ignoree(nom, chemin = new Set()) {
    if (memo.has(nom)) return memo.get(nom);
    if (chemin.has(nom)) return true;
    chemin.add(nom);
    const v = vulnerabilites[nom];
    const resultat = !!v && v.via.every((cause) =>
        typeof cause === 'string' ? ignoree(cause, chemin) : Object.hasOwn(ALERTES_IGNOREES, ghsa(cause.url)),
    );
    chemin.delete(nom);
    memo.set(nom, resultat);
    return resultat;
}

const bloquantes = Object.values(vulnerabilites).filter((v) => GRAVITES_BLOQUANTES.has(v.severity) && !ignoree(v.name));
const ignorees = Object.values(vulnerabilites).filter((v) => ignoree(v.name));

for (const [id, motif] of Object.entries(ALERTES_IGNOREES)) console.log(`Alerte ignorée : ${id} (${motif})`);
if (ignorees.length) console.log(`Paquets concernés : ${ignorees.map((v) => v.name).join(', ')}`);
if (bloquantes.length) {
    console.error(`\n${bloquantes.length} vulnérabilité(s) bloquante(s) :`);
    for (const v of bloquantes) {
        const alertes = v.via.filter((c) => typeof c !== 'string').map((c) => `${c.title} (${c.url})`);
        console.error(`- ${v.name} [${v.severity}]${alertes.length ? ` : ${alertes.join(' ; ')}` : ` via ${v.via.join(', ')}`}`);
    }
    process.exit(1);
}
console.log('Aucune vulnérabilité bloquante dans les dépendances de production.');
