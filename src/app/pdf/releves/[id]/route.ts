import { id, reponsePdf } from "@/lib/pdf-route";
import { pdfReleve } from "@/lib/services/pdf";

export async function GET(_: Request, { params }: RouteContext<"/pdf/releves/[id]">) {
  const inscription = id((await params).id);
  return reponsePdf("pdf.releve", (ctx) => pdfReleve(ctx.db, inscription));
}
