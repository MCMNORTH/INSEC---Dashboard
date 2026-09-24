import bcrypt from "bcryptjs";

/** Hachage bcrypt, compatible avec les mots de passe de l'ancienne application ($2y$). */
export async function hacher(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, 12);
}

export async function verifier(motDePasse: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(motDePasse, hash);
}

/** Hash factice pour garder un temps de réponse constant quand l'e-mail n'existe pas. */
export const HASH_FACTICE = "$2b$12$eNt/kq5iW0J5/33..o//O.krNC9jnhn9Hmht6UKBuF/TpmTOojdGa";
