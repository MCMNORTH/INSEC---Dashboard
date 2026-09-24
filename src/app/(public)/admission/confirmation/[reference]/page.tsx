import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { candidatures } from "@/db/schema";

export const metadata: Metadata = { title: "Candidature reçue" };

/** Masque partiellement l'adresse pour ne pas exposer de donnée personnelle via l'URL de confirmation. */
function masquer(email: string): string {
  const [local, domaine] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${domaine}`;
}

export default async function Confirmation({ params }: PageProps<"/admission/confirmation/[reference]">) {
  const reference = decodeURIComponent((await params).reference);
  const [c] = await getDb().select().from(candidatures).where(eq(candidatures.reference, reference));
  if (!c) notFound();
  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center p-6">
      <main className="max-w-lg bg-white border rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto text-2xl">✓</div>
        <h1 className="text-2xl font-bold text-insec mt-5">Candidature bien reçue</h1>
        <p className="text-gray-500 mt-2">Conservez cette référence pour vos échanges avec l’INSEC.</p>
        <div className="bg-gray-50 border rounded-xl p-4 my-6">
          <p className="text-xs text-gray-400 uppercase">Référence</p>
          <p className="text-xl font-mono font-bold text-insec mt-1">{c.reference}</p>
        </div>
        <p className="text-sm text-gray-500">
          Un retour sera envoyé à <strong>{masquer(c.email)}</strong> après étude du dossier.
        </p>
        <Link href="/login" className="inline-block mt-6 text-insec font-semibold">
          Retour à l’accueil
        </Link>
      </main>
    </div>
  );
}
