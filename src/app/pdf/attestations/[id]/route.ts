import { id, reponsePdf } from "@/lib/pdf-route";
import { pdfAttestation } from "@/lib/services/pdf";

export async function GET(_: Request, { params }: RouteContext<"/pdf/attestations/[id]">) {
  const inscription = id((await params).id);
  return reponsePdf("pdf.attestation", (ctx) => pdfAttestation(ctx.db, inscription));
}
