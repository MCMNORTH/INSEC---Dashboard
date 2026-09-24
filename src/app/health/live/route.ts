export const dynamic = "force-dynamic";

/** Sonde de vivacité : le processus HTTP répond. */
export function GET() {
  return Response.json({ status: "ok", application: "INSEC Dashboard", timestamp: new Date().toISOString() });
}
