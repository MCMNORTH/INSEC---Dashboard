"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function LienNav({
  href,
  prefixe,
  icone,
  children,
  badge,
}: {
  href: string;
  prefixe?: string;
  icone: string;
  children: ReactNode;
  badge?: number;
}) {
  const chemin = usePathname();
  const actif = chemin === href || chemin.startsWith(`${prefixe ?? href}/`) || (prefixe ? chemin === prefixe : false);
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
        actif ? "bg-insec text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <span className="flex items-center gap-3">
        <i className={`fa-solid ${icone} w-4 text-center`} aria-hidden />
        {children}
      </span>
      {badge ? (
        <span className={`text-xs rounded-full px-2 py-0.5 ${actif ? "bg-white text-insec" : "bg-red-100 text-red-700"}`}>{badge}</span>
      ) : null}
    </Link>
  );
}
