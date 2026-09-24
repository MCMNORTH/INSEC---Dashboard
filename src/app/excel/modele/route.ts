import { reponseExcel } from "@/lib/excel-route";
import { modeleImport } from "@/lib/services/excel";

export async function GET() {
  return reponseExcel("excel.modele", "Téléchargement du modèle d’import étudiants", "modele-import-etudiants.xlsx", () => modeleImport());
}
