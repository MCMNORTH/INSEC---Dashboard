import { id, reponsePdf } from "@/lib/pdf-route";
import { FINANCE } from "@/lib/roles";
import { pdfRecu } from "@/lib/services/pdf";

/** Les reçus sont aussi accessibles au service financier. */
export async function GET(_: Request, { params }: RouteContext<"/pdf/recus/[id]">) {
  const versement = id((await params).id);
  return reponsePdf("pdf.recu", (ctx) => pdfRecu(ctx.db, versement), FINANCE);
}
