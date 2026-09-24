import { reponseExcel } from "@/lib/excel-route";
import { exporterFinances } from "@/lib/services/excel";

export async function GET() {
  return reponseExcel("excel.finances", "Export Excel des finances", "finances-insec-{date}.xlsx", exporterFinances);
}
