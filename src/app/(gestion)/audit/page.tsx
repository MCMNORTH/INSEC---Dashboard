import type { Metadata } from "next";
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { journalAudit, users } from "@/db/schema";
import { EnTete, Pagination, pageDepuis, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { formatDateHeureSecondes } from "@/lib/format";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Journal d’audit" };

const PAR_PAGE = 40;
const ACTIONS: [string, string][] = [
  ["created", "Création"],
  ["updated", "Modification"],
  ["deleted", "Suppression"],
  ["download", "Téléchargement"],
  ["export", "Export"],
  ["import", "Import"],
  ["backup", "Sauvegarde"],
  ["restore", "Restauration"],
];

const dateValide = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

function valeur(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export default async function Audit({ searchParams }: PageProps<"/audit">) {
  await exigerRole(ADMINS);
  const sp = await searchParams;
  const action = param(sp.action);
  const modele = param(sp.modele);
  const userId = Number(param(sp.user_id)) || undefined;
  const du = dateValide(param(sp.du));
  const au = dateValide(param(sp.au));
  const page = pageDepuis(sp.page);
  const db = getDb();

  const filtre = and(
    action ? eq(journalAudit.action, action) : undefined,
    modele ? eq(journalAudit.modele, modele) : undefined,
    userId ? eq(journalAudit.userId, userId) : undefined,
    du ? gte(journalAudit.createdAt, new Date(`${du}T00:00:00Z`)) : undefined,
    au ? lt(journalAudit.createdAt, sql`${`${au}T00:00:00Z`}::timestamptz + interval '1 day'`) : undefined,
  );
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(journalAudit).where(filtre);
  const logs = await db
    .select()
    .from(journalAudit)
    .where(filtre)
    .orderBy(desc(journalAudit.createdAt), desc(journalAudit.id))
    .limit(PAR_PAGE)
    .offset((page - 1) * PAR_PAGE);
  const utilisateurs = await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
  const modeles = (
    await db.selectDistinct({ modele: journalAudit.modele }).from(journalAudit).where(isNotNull(journalAudit.modele)).orderBy(asc(journalAudit.modele))
  ).map((m) => m.modele as string);

  return (
    <>
      <EnTete
        surtitre="Sécurité et traçabilité"
        titre="Journal d’audit"
        description="Historique des opérations sensibles réalisées dans le dashboard."
      />
      <form method="GET" className="bg-white border rounded-xl p-4 mb-5 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <select name="action" defaultValue={action ?? ""} aria-label="Action" className="rounded-lg text-sm">
          <option value="">Toutes les actions</option>
          {ACTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="modele" defaultValue={modele ?? ""} aria-label="Objet" className="rounded-lg text-sm">
          <option value="">Tous les objets</option>
          {modeles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select name="user_id" defaultValue={userId ?? ""} aria-label="Utilisateur" className="rounded-lg text-sm">
          <option value="">Tous les utilisateurs</option>
          {utilisateurs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input type="date" name="du" defaultValue={du} aria-label="Du" title="Du" className="rounded-lg text-sm" />
        <input type="date" name="au" defaultValue={au} aria-label="Au" title="Au" className="rounded-lg text-sm" />
        <button className="bg-insec text-white rounded-lg text-sm font-semibold py-2">Filtrer</button>
      </form>
      <div className="space-y-3">
        {logs.length ? (
          logs.map((log) => (
            <article key={log.id} className="bg-white border rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-3">
                  <span
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                      log.action === "deleted" ? "bg-red-50 text-red-600" : log.action === "updated" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <i
                      className={`fa-solid ${log.action === "download" ? "fa-download" : log.action === "deleted" ? "fa-trash" : "fa-pen-to-square"}`}
                      aria-hidden
                    />
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-insec">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {log.acteur || "Système"} · {formatDateHeureSecondes(log.createdAt)} · {log.adresseIp || "IP inconnue"}
                      {log.route ? ` · ${log.route}` : ""}
                    </p>
                  </div>
                </div>
                {log.modele && (
                  <span className="text-xs bg-gray-100 rounded-full px-3 py-1 h-fit">
                    {log.modele} #{log.modeleId}
                  </span>
                )}
              </div>
              {(log.avant || log.apres) && (
                <details className="mt-3 sm:ml-12">
                  <summary className="text-xs font-semibold text-gray-500 cursor-pointer">Voir les changements</summary>
                  <div className="grid md:grid-cols-2 gap-3 mt-2 text-xs">
                    {log.avant && (
                      <div className="bg-red-50/50 rounded p-3">
                        <strong>Avant</strong>
                        <dl className="mt-2 space-y-1">
                          {Object.entries(log.avant).map(([k, v]) => (
                            <div key={k} className="break-words">
                              <dt className="inline text-gray-400">{k} :</dt> <dd className="inline">{valeur(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    {log.apres && (
                      <div className="bg-green-50/50 rounded p-3">
                        <strong>Après</strong>
                        <dl className="mt-2 space-y-1">
                          {Object.entries(log.apres).map(([k, v]) => (
                            <div key={k} className="break-words">
                              <dt className="inline text-gray-400">{k} :</dt> <dd className="inline">{valeur(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </article>
          ))
        ) : (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-400">Aucune opération ne correspond aux filtres.</div>
        )}
      </div>
      <div className="mt-5">
        <Pagination
          page={page}
          total={total}
          parPage={PAR_PAGE}
          chemin="/audit"
          params={{ action, modele, user_id: param(sp.user_id), du, au }}
        />
      </div>
    </>
  );
}
