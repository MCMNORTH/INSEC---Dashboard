<?php
namespace Tests\Feature;

use App\Models\Etudiant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ExcelExchangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_download_student_workbook(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        Etudiant::create(['nom'=>'Ba','prenom'=>'Awa','email'=>'awa@example.com','telephone'=>'22000000','statut_etudiant'=>'Actif']);
        $response=$this->actingAs($admin)->get(route('excel.etudiants'));
        $response->assertOk()->assertHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringStartsWith('PK',$response->streamedContent());
    }

    public function test_admin_imports_valid_rows_and_reports_invalid_rows(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $book=new Spreadsheet();$book->getActiveSheet()->fromArray([['Prénom','Nom','E-mail','Téléphone','Statut'],['Awa','Ba','awa@example.com','22000000','Actif'],['Invalide','','pas-un-email','','Actif']]);
        $path=tempnam(sys_get_temp_dir(),'insec').'.xlsx';(new Xlsx($book))->save($path);
        $file=new UploadedFile($path,'import.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',null,true);
        $response=$this->actingAs($admin)->post(route('excel.importer'),['fichier'=>$file,'mode'=>'ignorer']);
        $response->assertRedirect()->assertSessionHas('import_resultat',fn($r)=>$r['crees']===1&&count($r['erreurs'])===1);
        $this->assertDatabaseHas('etudiants',['email'=>'awa@example.com']);
    }

    public function test_finance_role_cannot_access_excel_exchange(): void
    {
        $finance=User::factory()->create(['role'=>'finance']);
        $this->actingAs($finance)->get(route('excel.index'))->assertForbidden();
    }
}
