"use client";

import type { ReactNode } from "react";

/**
 * Petit formulaire relié à une Server Action simple (ex. activer un compte, archiver une alerte),
 * avec confirmation facultative.
 */
export function BoutonAction({
  action,
  children,
  className,
  confirmation,
  champs = {},
  titre,
  desactive,
}: {
  action: (donnees: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  confirmation?: string;
  champs?: Record<string, string | number>;
  titre?: string;
  desactive?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmation && !window.confirm(confirmation)) e.preventDefault();
      }}
    >
      {Object.entries(champs).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} title={titre} disabled={desactive}>
        {children}
      </button>
    </form>
  );
}
