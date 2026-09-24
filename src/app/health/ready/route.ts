import { getDb } from "@/db";
import { verifierDisponibilite } from "@/lib/services/readiness";

export const dynamic = "force-dynamic";

/** Sonde de disponibilité : 503 uniquement si une dépendance critique est défaillante. Aucun secret n'est exposé. */
export async function GET() {
  const r = await verifierDisponibilite(getDb());
  return Response.json(
    { status: r.status, checks: Object.fromEntries(Object.entries(r.checks).map(([k, c]) => [k, c.status])), checked_at: r.checked_at },
    { status: r.status === "failed" ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
