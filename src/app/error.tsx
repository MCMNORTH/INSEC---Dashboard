"use client";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md bg-white border rounded-2xl p-8 text-center shadow-sm">
        <p className="text-5xl font-bold text-insec">Oups</p>
        <h1 className="text-lg font-semibold mt-3">Une erreur est survenue</h1>
        <p className="text-gray-500 mt-2">L’opération n’a pas pu aboutir. Réessayez ; si le problème persiste, contactez l’administrateur{error.digest ? ` (réf. ${error.digest})` : ""}.</p>
        <button onClick={reset} className="mt-6 bg-insec text-white px-4 py-2 rounded-lg">Réessayer</button>
      </div>
    </main>
  );
}
