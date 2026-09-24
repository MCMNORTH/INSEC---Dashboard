import Link from "next/link";

export default function Introuvable() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md bg-white border rounded-2xl p-8 text-center shadow-sm">
        <p className="text-5xl font-bold text-insec">404</p>
        <h1 className="text-lg font-semibold mt-3">Page introuvable</h1>
        <p className="text-gray-500 mt-2">La ressource demandée n’existe pas ou a été supprimée.</p>
        <Link href="/dashboard" className="inline-block mt-6 text-insec font-semibold">Retour à mon espace</Link>
      </div>
    </main>
  );
}
