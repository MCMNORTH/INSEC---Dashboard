"use client";

import { createContext, startTransition, useActionState, useContext, useRef, type FormEvent, type ReactNode } from "react";
import type { EtatFormulaire } from "@/lib/actions";

type Action = (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>;

const EnCours = createContext(false);

/**
 * Formulaire relié à une Server Action. Les erreurs de validation s'affichent en haut du formulaire
 * et les valeurs saisies sont conservées (pas de réinitialisation automatique).
 */
export function Formulaire({
  action,
  children,
  className,
  erreurs = "liste",
  confirmation,
  reinitialiser = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  erreurs?: "liste" | "premiere";
  confirmation?: string;
  reinitialiser?: boolean;
}) {
  const [etat, dispatch, enCours] = useActionState(action, { erreurs: [] });
  const ref = useRef<HTMLFormElement>(null);

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmation && !window.confirm(confirmation)) return;
    const donnees = new FormData(e.currentTarget);
    startTransition(() => {
      dispatch(donnees);
    });
    if (reinitialiser) ref.current?.reset();
  }

  return (
    <form ref={ref} onSubmit={soumettre} className={className} noValidate={false}>
      {etat.erreurs.length > 0 && (
        <div role="alert" className="col-span-full bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {erreurs === "premiere" || etat.erreurs.length === 1 ? (
            etat.erreurs[0]
          ) : (
            <ul className="list-disc list-inside">
              {etat.erreurs.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {etat.ok && (
        <div role="status" className="col-span-full bg-green-50 text-green-700 text-sm p-3 rounded-lg">
          {etat.ok}
        </div>
      )}
      <EnCours.Provider value={enCours}>
        <fieldset disabled={enCours} className="contents">
          {children}
        </fieldset>
      </EnCours.Provider>
    </form>
  );
}

export function BoutonEnvoi({ children, className }: { children: ReactNode; className?: string }) {
  const enCours = useContext(EnCours);
  return (
    <button type="submit" className={`${className ?? ""} disabled:opacity-60`} aria-busy={enCours}>
      {enCours ? <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden /> : null}
      {children}
    </button>
  );
}
