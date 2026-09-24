"use client";

import { useState } from "react";
import type { EtatFormulaire } from "@/lib/actions";
import { BoutonEnvoi, Formulaire } from "./formulaire";

export function Restauration({ action }: { action: (e: EtatFormulaire, fd: FormData) => Promise<EtatFormulaire> }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="w-full">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="bg-red-600 text-white rounded-lg px-3 py-2 text-xs font-semibold">
        Restaurer
      </button>
      {ouvert && (
        <Formulaire
          action={action}
          erreurs="premiere"
          confirmation="Toutes les données actuelles seront remplacées par celles de cette sauvegarde. Continuer ?"
          className="mt-4 border-t pt-4 grid md:grid-cols-3 gap-3 items-end"
        >
          <label className="text-xs font-semibold text-gray-600">
            Mot de passe du compte
            <input type="password" name="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg text-sm" />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Tapez RESTAURER
            <input name="confirmation" required pattern="RESTAURER" autoComplete="off" className="mt-1 w-full rounded-lg text-sm" />
          </label>
          <BoutonEnvoi className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-semibold">Confirmer la restauration</BoutonEnvoi>
        </Formulaire>
      )}
    </div>
  );
}
