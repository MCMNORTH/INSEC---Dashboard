import { z } from "zod";

/** Erreur métier affichée telle quelle à l'utilisateur (équivalent des abort(422) Laravel). */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Erreur de validation : une liste de messages destinés au formulaire. */
export class ValidationError extends AppError {
  constructor(public readonly messages: string[]) {
    super(messages[0] ?? "Données invalides.", 422);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Vous n’êtes pas autorisé à accéder à cette page.") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/** Valide des données avec un schéma zod et lève une ValidationError lisible. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((issue) => issue.message));
  }
  return result.data;
}

/** Détecte une violation de contrainte d'unicité PostgreSQL (code 23505). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = (error as { cause?: unknown })?.cause ?? error;
  const pg = e as { code?: string; constraint?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint === constraint);
}
