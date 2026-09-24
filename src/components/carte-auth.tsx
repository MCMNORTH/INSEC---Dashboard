import type { ReactNode } from "react";

/** Mise en page des écrans de connexion (reprise du design de l'ancienne page de connexion). */
export function CarteAuth({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[#f0f2f5]">
      <div className="w-full max-w-[950px] bg-white rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.1)] grid md:grid-cols-12">
        <div className="md:col-span-5 bg-gradient-to-br from-insec to-[#293241] text-white p-10 flex flex-col justify-center text-center">
          <h2 className="font-bold text-2xl mb-3">ESPACE INSEC</h2>
          <p className="mb-6 text-sm opacity-80">Gérez votre tableau de bord et vos accès en toute sécurité.</p>
          <div className="p-3 border border-white/60 rounded bg-white/10">
            <span className="text-xs uppercase tracking-wider font-bold text-or">Plateforme officielle</span>
          </div>
        </div>
        <div className="md:col-span-7 p-8 md:p-10 flex flex-col justify-center">
          <h1 className="font-bold text-2xl text-insec mb-1">{titre}</h1>
          <p className="text-gray-500 mb-4 text-sm">{sousTitre}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export const champAuth = "w-full rounded-lg text-sm";
export const boutonAuth = "w-full bg-insec hover:bg-or text-white font-semibold py-2.5 rounded-lg transition-colors";
