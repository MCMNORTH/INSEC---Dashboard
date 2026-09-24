import { reponseExcel } from "@/lib/excel-route";
import { exporterEtudiants } from "@/lib/services/excel";

export async function GET() {
  return reponseExcel("excel.etudiants", "Export Excel des étudiants", "etudiants-insec-{date}.xlsx", exporterEtudiants);
}
