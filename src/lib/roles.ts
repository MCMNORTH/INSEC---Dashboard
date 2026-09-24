export const ROLES = ["super_admin", "admin", "finance", "enseignant", "etudiant"] as const;
export type Role = (typeof ROLES)[number];

export const ADMINS: Role[] = ["admin", "super_admin"];
export const FINANCE: Role[] = ["admin", "super_admin", "finance"];
export const SUPER_ADMIN: Role[] = ["super_admin"];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Administrateur",
  finance: "Finance",
  enseignant: "Enseignant",
  etudiant: "Étudiant",
};

export function isStaff(role: string): boolean {
  return (FINANCE as string[]).includes(role);
}

/** Page d'accueil de chaque rôle après connexion. */
export function homeFor(role: string): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin/dashboard";
    case "finance":
      return "/finances";
    case "enseignant":
      return "/portail/enseignant";
    case "etudiant":
      return "/portail/etudiant";
    default:
      return "/login";
  }
}

/** Chemin interne sûr pour une redirection (refuse les URL externes, « //hote » et « /\\hote »). */
export function cheminInterne(valeur: unknown, defaut: string): string {
  return typeof valeur === "string" && /^\/(?![\/\\])/.test(valeur) && !/[\r\n]/.test(valeur) ? valeur : defaut;
}
