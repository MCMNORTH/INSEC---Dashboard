import { id, reponsePdf } from "@/lib/pdf-route";
import { pdfConvocation } from "@/lib/services/pdf";

export async function GET(_: Request, { params }: RouteContext<"/pdf/convocations/[examen]/[resultat]">) {
  const p = await params;
  const examen = id(p.examen);
  const resultat = id(p.resultat);
  return reponsePdf("pdf.convocation", (ctx) => pdfConvocation(ctx.db, examen, resultat));
}
