<?php
namespace App\Http\Controllers;

use App\Models\Etudiant;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExcelController extends Controller
{
    public function index(){ return view('excel.index'); }

    public function modele(): StreamedResponse
    {
        $classeur=$this->classeur('Modèle import étudiants',['Prénom','Nom','E-mail','Téléphone','Statut']);
        $feuille=$classeur->getActiveSheet();
        $feuille->fromArray([['Awa','Ba','awa@example.com','22000000','Actif']],null,'A2');
        $feuille->getStyle('A2:E2')->getFont()->getColor()->setARGB('FF777777');
        $feuille->getColumnDimension('A')->setWidth(20); $feuille->getColumnDimension('B')->setWidth(20); $feuille->getColumnDimension('C')->setWidth(32); $feuille->getColumnDimension('D')->setWidth(18); $feuille->getColumnDimension('E')->setWidth(16);
        return $this->telecharger($classeur,'modele-import-etudiants.xlsx');
    }

    public function etudiants(): StreamedResponse
    {
        $headers=['ID','Prénom','Nom','E-mail','Téléphone','Statut étudiant','Diplôme actuel','Année académique','Année parcours','N° INTEC','Statut inscription'];
        $classeur=$this->classeur('Étudiants',$headers); $s=$classeur->getActiveSheet(); $ligne=2;
        Etudiant::with(['derniereInscription.formation','derniereInscription.anneeAcademique'])->orderBy('nom')->each(function($e)use($s,&$ligne){$i=$e->derniereInscription;$this->ecrire($s,$ligne++,[$e->id_etudiant,$e->prenom,$e->nom,$e->email,$e->telephone,$e->statut_etudiant,$i?->formation?->code,$i?->anneeAcademique?->libelle,$i?->annee_parcours,$i?->numero_inscription_intec,$i?->statut]);});
        $this->finaliser($s,'A1:K'.max(2,$ligne-1)); return $this->telecharger($classeur,'etudiants-insec-'.now()->format('Ymd').'.xlsx');
    }

    public function finances(): StreamedResponse
    {
        $headers=['Étudiant','E-mail','Diplôme','Année académique','Montant dû','Remise','Montant net','Total versé','Solde restant','Montant en retard','Statut paiement'];
        $classeur=$this->classeur('Finances',$headers); $s=$classeur->getActiveSheet(); $ligne=2;
        Inscription::with(['etudiant','formation','anneeAcademique','versements','echeances'])->latest()->get()->each(function($i)use($s,&$ligne){$this->ecrire($s,$ligne++,[$i->etudiant->prenom.' '.$i->etudiant->nom,$i->etudiant->email,$i->formation->code,$i->anneeAcademique->libelle,(float)$i->montant_du,(float)$i->montant_remise,(float)$i->montant_net,(float)$i->total_verse,(float)$i->solde_restant,(float)$i->montant_en_retard,$i->statut_paiement]);});
        $this->finaliser($s,'A1:K'.max(2,$ligne-1)); $s->getStyle('E2:J'.max(2,$ligne-1))->getNumberFormat()->setFormatCode('#,##0 "MRU"'); return $this->telecharger($classeur,'finances-insec-'.now()->format('Ymd').'.xlsx');
    }

    public function resultats(): StreamedResponse
    {
        $headers=['Étudiant','E-mail','Diplôme','UE','Libellé UE','Session','Date examen','Présence','Note','Note sur','Décision'];
        $classeur=$this->classeur('Résultats',$headers); $s=$classeur->getActiveSheet(); $ligne=2;
        ResultatExamen::with(['inscription.etudiant','inscription.formation','examen.ue'])->whereNotNull('note')->get()->each(function($r)use($s,&$ligne){$this->ecrire($s,$ligne++,[$r->inscription->etudiant->prenom.' '.$r->inscription->etudiant->nom,$r->inscription->etudiant->email,$r->inscription->formation->code,$r->examen->ue->code,$r->examen->ue->libelle,$r->examen->session,$r->examen->date_examen->format('d/m/Y H:i'),$r->presence,(float)$r->note,(float)$r->examen->note_sur,$r->valide?'Validée':'Non validée']);});
        $this->finaliser($s,'A1:K'.max(2,$ligne-1)); $s->getStyle('I2:J'.max(2,$ligne-1))->getNumberFormat()->setFormatCode('0.00'); return $this->telecharger($classeur,'resultats-insec-'.now()->format('Ymd').'.xlsx');
    }

    public function importer(Request $request)
    {
        $request->validate(['fichier'=>'required|file|mimes:xlsx,xls,csv|max:5120','mode'=>'required|in:ignorer,mettre_a_jour']);
        $sheet=IOFactory::load($request->file('fichier')->getRealPath())->getActiveSheet();
        $lignes=$sheet->toArray(null,true,true,false); $entetes=array_map(fn($v)=>trim((string)$v),array_shift($lignes)??[]);
        abort_unless(array_slice($entetes,0,5)===['Prénom','Nom','E-mail','Téléphone','Statut'],422,'Les colonnes du fichier ne correspondent pas au modèle INSEC.');
        $crees=0;$misAJour=0;$ignores=0;$erreurs=[];
        foreach($lignes as $index=>$row){$numero=$index+2;if(count(array_filter($row,fn($v)=>$v!==null&&$v!==''))===0)continue;$data=['prenom'=>trim((string)($row[0]??'')),'nom'=>trim((string)($row[1]??'')),'email'=>mb_strtolower(trim((string)($row[2]??''))),'telephone'=>trim((string)($row[3]??'')),'statut_etudiant'=>trim((string)($row[4]??''))];
            $v=Validator::make($data,['prenom'=>'required|string|max:100','nom'=>'required|string|max:100','email'=>'required|email|max:255','telephone'=>'nullable|string|max:40','statut_etudiant'=>['required',Rule::in(['Actif','Suspendu','Diplômé','Abandon'])]]);
            if($v->fails()){$erreurs[]='Ligne '.$numero.' : '.implode(' ',$v->errors()->all());continue;}
            $existant=Etudiant::where('email',$data['email'])->first(); if($existant&&$request->mode==='ignorer'){$ignores++;continue;} if($existant){$existant->update($data);$misAJour++;}else{Etudiant::create($data);$crees++;}
        }
        return back()->with('import_resultat',compact('crees','misAJour','ignores','erreurs'));
    }

    private function classeur(string $titre,array $headers): Spreadsheet
    { $w=new Spreadsheet();$s=$w->getActiveSheet();$s->setTitle(mb_substr($titre,0,31));$s->fromArray($headers,null,'A1');$last=$s->getHighestColumn();$s->getStyle('A1:'.$last.'1')->applyFromArray(['font'=>['bold'=>true,'color'=>['argb'=>'FFFFFFFF']],'fill'=>['fillType'=>Fill::FILL_SOLID,'startColor'=>['argb'=>'FF1E2761']]]);$s->freezePane('A2');$s->setAutoFilter('A1:'.$last.'1');return $w; }
    private function ecrire($sheet,int $row,array $values): void { foreach($values as $i=>$value){$cell=chr(65+$i).$row;if(is_int($value)||is_float($value))$sheet->setCellValue($cell,$value);else$sheet->setCellValueExplicit($cell,(string)($value??''),DataType::TYPE_STRING);} }
    private function finaliser($sheet,string $range): void { foreach(range('A',$sheet->getHighestColumn()) as $col)$sheet->getColumnDimension($col)->setAutoSize(true);$sheet->getStyle($range)->getBorders()->getBottom()->getColor()->setARGB('FFE5E7EB'); }
    private function telecharger(Spreadsheet $classeur,string $nom): StreamedResponse { return response()->streamDownload(function()use($classeur){(new Xlsx($classeur))->save('php://output');$classeur->disconnectWorksheets();},$nom,['Content-Type'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']); }
}
