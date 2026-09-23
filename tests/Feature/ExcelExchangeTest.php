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

    public function test_exports_keep_selected_year_and_absences(): void
    {
        $this->seed(\Database\Seeders\DatabaseSeeder::class);
        $import = require database_path('migrations/2026_09_22_000014_import_bumex_dgc_2024_2025.php');
        $import->up();
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $year = \App\Models\AnneeAcademique::where('libelle', '2024-2025')->firstOrFail();
        foreach (['excel.etudiants' => 12, 'excel.finances' => 12, 'excel.resultats' => 42] as $route => $rows) {
            $response = $this->get(route($route, ['annee_id' => $year->id]))->assertOk();
            $path = tempnam(sys_get_temp_dir(), 'insec-export');
            try {
                file_put_contents($path, $response->streamedContent());
                $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
                $sheet = $book->getActiveSheet();
                $this->assertSame($rows, $sheet->getHighestRow());
                if ($route === 'excel.resultats') {
                    $data = array_slice($sheet->toArray(), 1);
                    $absents = array_filter($data, fn ($row) => $row[7] === 'Non présenté');
                    $unknown = array_filter($data, fn ($row) => $row[7] === 'Non renseigné');
                    $this->assertCount(13, $absents);
                    foreach ($absents as $row) {
                        $this->assertEmpty($row[8]);
                        $this->assertSame('Absent à l’examen', $row[10]);
                    }
                    foreach ($unknown as $row) $this->assertSame('Présence non renseignée', $row[10]);
                }
                $book->disconnectWorksheets();
            } finally {
                unlink($path);
            }
        }
        $current = \App\Models\AnneeAcademique::where('libelle', '2026-2027')->firstOrFail();
        $response = $this->get(route('excel.etudiants', ['annee_id' => $current->id]))->assertOk();
        $path = tempnam(sys_get_temp_dir(), 'insec-export');
        try {
            file_put_contents($path, $response->streamedContent());
            $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
            $this->assertEmpty($book->getActiveSheet()->getCell('A2')->getValue());
            $book->disconnectWorksheets();
        } finally { unlink($path); }
    }
}
