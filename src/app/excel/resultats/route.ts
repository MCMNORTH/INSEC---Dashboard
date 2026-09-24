import { reponseExcel } from "@/lib/excel-route";
import { exporterResultats } from "@/lib/services/excel";

export async function GET() {
  return reponseExcel("excel.resultats", "Export Excel des résultats", "resultats-insec-{date}.xlsx", exporterResultats);
}
