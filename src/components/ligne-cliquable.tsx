"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Ligne de tableau entièrement cliquable (hors cellules marquées data-no-row-click). */
export function LigneCliquable({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      className={`${className ?? ""} cursor-pointer`}
      onClick={(e) => {
        const cible = e.target as HTMLElement;
        if (cible.closest("[data-no-row-click], a, button, input, select, textarea, form")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
