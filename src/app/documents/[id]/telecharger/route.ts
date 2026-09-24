import { notFound } from "next/navigation";
import { idDepuis } from "@/components/ui";
import { contexte } from "@/lib/auth/current";
import { NotFoundError } from "@/lib/errors";
import { telechargement } from "@/lib/http";
import { ADMINS } from "@/lib/roles";
import { telechargerPiece } from "@/lib/services/documents";

export async function GET(_: Request, { params }: RouteContext<"/documents/[id]/telecharger">) {
  const ctx = await contexte(ADMINS, "documents.download");
  const id = idDepuis((await params).id);
  if (!id) notFound();
  try {
    const { piece, contenu } = await telechargerPiece(ctx, id);
    return telechargement(contenu, piece.nomOriginal, piece.mimeType);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}
