/**
 * Garde-fou : chaque Server Action et chaque route de téléchargement doit vérifier l'utilisateur
 * avant toute opération. Les seules exceptions sont les écrans publics (connexion, admission, santé, cron).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(import.meta.dirname, "../../src/app");
const PUBLICS = ["(public)", "health", path.join("api", "cron")];
const CONTROLES = /\b(contexte|exigerConnexion|exigerRole|reponsePdf|reponseExcel)\(/;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

function fonctionsExportees(source: string): { nom: string; corps: string }[] {
  const res: { nom: string; corps: string }[] = [];
  const re = /export (?:async )?function (\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const suivant = source.indexOf("\nexport ", m.index + 1);
    res.push({ nom: m[1], corps: source.slice(m.index, suivant === -1 ? undefined : suivant) });
  }
  return res;
}

describe("Autorisations", () => {
  const tous = fichiers(RACINE).filter((f) => !PUBLICS.some((p) => path.relative(RACINE, f).startsWith(p)));

  it("chaque Server Action vérifie l’utilisateur", () => {
    const actions = tous.filter((f) => f.endsWith(".ts") && readFileSync(f, "utf8").startsWith('"use server"'));
    expect(actions.length).toBeGreaterThan(8);
    for (const f of actions) {
      for (const { nom, corps } of fonctionsExportees(readFileSync(f, "utf8"))) {
        expect(CONTROLES.test(corps), `${path.relative(RACINE, f)} › ${nom}`).toBe(true);
      }
    }
  });

  it("chaque route (téléchargement, PDF, Excel) vérifie l’utilisateur", () => {
    const routes = tous.filter((f) => f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThan(8);
    for (const f of routes) expect(CONTROLES.test(readFileSync(f, "utf8")), path.relative(RACINE, f)).toBe(true);
  });

  it("chaque page de gestion vérifie le rôle (en plus du layout)", () => {
    const pages = tous.filter((f) => f.endsWith("page.tsx") && (f.includes("(gestion)") || f.includes("(portail)")));
    expect(pages.length).toBeGreaterThan(20);
    for (const f of pages) expect(/exigerRole\(/.test(readFileSync(f, "utf8")), path.relative(RACINE, f)).toBe(true);
  });
});
