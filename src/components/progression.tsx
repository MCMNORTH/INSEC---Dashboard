import type { DossierEtudiant } from "@/lib/chargements";
import { creditsValides } from "@/lib/domain/calculs";

export function ProgressionAcademique({ inscriptions }: { inscriptions: DossierEtudiant["inscriptions"] }) {
  if (!inscriptions.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-insec mb-3">Progression académique</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {inscriptions.map((i) => {
          const total = i.ues.reduce((s, u) => s + u.credits, 0);
          const valides = creditsValides(i.resultats);
          const pct = total > 0 ? Math.min(100, Math.round((valides * 100) / total)) : 0;
          return (
            <div key={i.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between gap-3">
                <strong>
                  {i.formation?.code} · {i.annee?.libelle}
                </strong>
                <span className="text-sm text-gray-500">
                  {valides}/{total} ECTS
                </span>
              </div>
              <div className="h-2 rounded bg-gray-200 mt-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded bg-green-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{pct} % des crédits des UE inscrites sont validés.</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
