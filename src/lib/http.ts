/** Réponse de téléchargement avec un nom de fichier correctement encodé (accents compris). */
export function telechargement(contenu: Uint8Array | Buffer, nom: string, mime: string): Response {
  const ascii = nom.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "fichier";
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(contenu.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
