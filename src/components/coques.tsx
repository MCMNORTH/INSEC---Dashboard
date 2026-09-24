import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/db/schema";
import { getDb } from "@/db";
import { deconnexion } from "@/app/(public)/login/actions";
import { nombreNonLues } from "@/lib/services/alertes";
import { LienNav } from "./lien-nav";
import { MenuMobile } from "./menu-mobile";

const ADMIN = ["admin", "super_admin"];

async function Barre({ user }: { user: User }) {
  const nonLues = await nombreNonLues(getDb(), user.id);
  const admin = ADMIN.includes(user.role);
  const finance = admin || user.role === "finance";
  return (
    <nav className="space-y-1" aria-label="Navigation principale">
      <LienNav href={admin ? "/admin/dashboard" : "/finances"} prefixe="/admin" icone="fa-table-cells-large">
        Tableau de bord
      </LienNav>
      <LienNav href="/alertes" icone="fa-bell" badge={nonLues}>
        Alertes
      </LienNav>
      {admin && (
        <>
          <LienNav href="/candidatures" icone="fa-file-signature">
            Admissions
          </LienNav>
          <LienNav href="/etudiants" icone="fa-user">
            Étudiants
          </LienNav>
          <LienNav href="/enseignants" icone="fa-chalkboard-user">
            Enseignants
          </LienNav>
          <LienNav href="/formations" icone="fa-graduation-cap">
            Diplômes & UE
          </LienNav>
          <LienNav href="/examens" icone="fa-clipboard-check">
            Examens & résultats
          </LienNav>
        </>
      )}
      {finance && (
        <LienNav href="/finances" icone="fa-dollar-sign">
          Finances
        </LienNav>
      )}
      {admin && (
        <>
          <LienNav href="/comptes" icone="fa-users-gear">
            Comptes & accès
          </LienNav>
          <LienNav href="/communications" icone="fa-envelope">
            Communications
          </LienNav>
          <LienNav href="/excel" icone="fa-file-excel">
            Imports & exports
          </LienNav>
          <LienNav href="/audit" icone="fa-clock-rotate-left">
            Journal d’audit
          </LienNav>
          {user.role === "super_admin" && (
            <LienNav href="/sauvegardes" icone="fa-database">
              Sauvegardes
            </LienNav>
          )}
        </>
      )}
      <form action={deconnexion} className="pt-5">
        <button className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:text-red-600">
          <i className="fa-solid fa-right-from-bracket w-4 text-center" aria-hidden /> Déconnexion
        </button>
      </form>
    </nav>
  );
}

function Marque({ user }: { user: User }) {
  return (
    <div className="mb-8 text-center">
      <Image src="/logo-insec.png" alt="Logo INSEC" width={80} height={80} className="w-20 h-20 mx-auto object-contain mb-2" priority />
      <div className="border-t-2 border-or w-12 mx-auto" />
      <p className="text-insec font-bold text-xl mt-3">INSEC</p>
      <p className="text-xs text-gray-400">{user.role === "finance" ? "Espace finance" : "Espace administration"}</p>
      <p className="text-xs text-gray-500 mt-2 truncate" title={user.email}>
        {user.name}
      </p>
    </div>
  );
}

/** Mise en page de l'espace administration / finance : barre latérale + contenu. */
export async function CoqueGestion({ user, children, large = true }: { user: User; children: ReactNode; large?: boolean }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-gray-200 min-h-screen p-4">
        <Marque user={user} />
        <Barre user={user} />
      </aside>
      <div className="flex-1 min-w-0">
        <MenuMobile titre="INSEC">
          <Marque user={user} />
          <Barre user={user} />
        </MenuMobile>
        <main className={`p-4 sm:p-6 lg:p-8 min-w-0 ${large ? "" : "max-w-4xl"}`}>{children}</main>
      </div>
    </div>
  );
}

/** En-tête des portails étudiant et enseignant. */
export async function CoquePortail({ user, espace, children }: { user: User; espace: string; children: ReactNode }) {
  const nonLues = await nombreNonLues(getDb(), user.id);
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-insec text-white px-4 sm:px-6 py-4 flex flex-wrap gap-3 justify-between items-center">
        <Link href={user.role === "etudiant" ? "/portail/etudiant" : "/portail/enseignant"}>
          <strong className="text-xl">INSEC</strong>
          <span className="text-blue-200 ml-3">{espace}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/alertes" className="text-sm bg-white/10 px-3 py-2 rounded">
            <i className="fa-solid fa-bell mr-1" aria-hidden /> Alertes
            {nonLues ? <span className="ml-1 bg-red-500 rounded-full px-2 py-0.5">{nonLues}</span> : null}
          </Link>
          <form action={deconnexion}>
            <button className="text-sm bg-white/10 px-3 py-2 rounded">Déconnexion</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
