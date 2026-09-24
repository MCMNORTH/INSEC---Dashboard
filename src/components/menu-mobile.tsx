"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/** Barre supérieure avec menu déroulant sur petit écran (la barre latérale est masquée). */
export function MenuMobile({ titre, children }: { titre: string; children: ReactNode }) {
  const chemin = usePathname();
  // Le menu se referme automatiquement après une navigation.
  const [ouvertSur, setOuvertSur] = useState<string | null>(null);
  const ouvert = ouvertSur === chemin;
  return (
    <div className="lg:hidden bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <strong className="text-insec text-lg">{titre}</strong>
        <button
          type="button"
          onClick={() => setOuvertSur(ouvert ? null : chemin)}
          aria-expanded={ouvert}
          className="px-3 py-2 rounded-lg border text-gray-600"
        >
          <i className={`fa-solid ${ouvert ? "fa-xmark" : "fa-bars"}`} aria-hidden />
          <span className="sr-only">Menu</span>
        </button>
      </div>
      {ouvert && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
