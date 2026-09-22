<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicYearNavigationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    public function test_students_can_be_filtered_by_academic_year(): void
    {
        [$ancienne, $courante, $ancienEtudiant, $etudiantCourant] = $this->studentsInTwoYears();

        $this->get(route('etudiants.index', ['annee_id' => $ancienne->id]))
            ->assertOk()
            ->assertSee($ancienne->libelle)
            ->assertSee($ancienEtudiant->nom)
            ->assertDontSee($etudiantCourant->nom);
    }

    public function test_finances_use_the_selected_academic_year(): void
    {
        [$ancienne, , $ancienEtudiant, $etudiantCourant] = $this->studentsInTwoYears();

        $this->get(route('finances.index', ['annee_id' => $ancienne->id]))
            ->assertOk()
            ->assertSee($ancienne->libelle)
            ->assertSee($ancienEtudiant->nom)
            ->assertDontSee($etudiantCourant->nom);
    }

    public function test_academic_page_exposes_all_years_and_selected_year_statistics(): void
    {
        [$ancienne] = $this->studentsInTwoYears();

        $this->get(route('academique.index', ['annee_id' => $ancienne->id]))
            ->assertOk()
            ->assertSee('2024-2025')
            ->assertSee('2026-2027')
            ->assertSee('1 étudiant(s)');
    }

    private function studentsInTwoYears(): array
    {
        $ancienne = AnneeAcademique::where('libelle', '2024-2025')->firstOrFail();
        $courante = AnneeAcademique::where('libelle', '2026-2027')->firstOrFail();
        $formation = Formation::where('code', 'DGC')->firstOrFail();

        $ancienEtudiant = Etudiant::create([
            'nom' => 'HistoriqueTest', 'prenom' => 'Awa', 'email' => 'historique@example.test', 'statut_etudiant' => 'Actif',
        ]);
        $ancienEtudiant->inscriptions()->create([
            'id_formation' => $formation->id, 'id_annee_academique' => $ancienne->id, 'annee_parcours' => 1,
        ]);

        $etudiantCourant = Etudiant::create([
            'nom' => 'CourantTest', 'prenom' => 'Ali', 'email' => 'courant@example.test', 'statut_etudiant' => 'Actif',
        ]);
        $etudiantCourant->inscriptions()->create([
            'id_formation' => $formation->id, 'id_annee_academique' => $courante->id, 'annee_parcours' => 1,
        ]);

        return [$ancienne, $courante, $ancienEtudiant, $etudiantCourant];
    }
}
