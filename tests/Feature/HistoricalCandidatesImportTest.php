<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoricalCandidatesImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_bumex_candidates_and_results_are_imported_from_the_supplied_sources(): void
    {
        $this->seed(DatabaseSeeder::class);
        $account = User::factory()->create(['name' => 'Mohamed Cheikh', 'email' => 'mohamed.cheikh@bumex.mr', 'role' => 'admin']);

        $migration = require database_path('migrations/2026_09_22_000014_import_bumex_dgc_2024_2025.php');
        $migration->up();

        $year = AnneeAcademique::where('libelle', '2024-2025')->firstOrFail();
        $enrollments = Inscription::where('id_annee_academique', $year->id)->where('financeur', 'bumex')->get();

        $this->assertCount(11, $enrollments);
        $this->assertSame(41, $enrollments->sum(fn ($enrollment) => $enrollment->ues()->count()));
        $this->assertSame(4, Examen::where('annee_academique_id', $year->id)->whereDate('date_examen', '2025-05-05')->count());
        $this->assertSame(13, ResultatExamen::whereIn('inscription_id', $enrollments->pluck('id'))->where('presence', 'Non présenté')->count());
        $this->assertSame(4, ResultatExamen::whereIn('inscription_id', $enrollments->pluck('id'))->where('presence', 'Non renseigné')->count());
        $this->assertDatabaseHas('etudiants', ['nom' => "B'LAL", 'prenom' => 'Fatimetou', 'email' => null, 'date_naissance' => '1990-09-17']);
        $this->assertDatabaseMissing('etudiants', ['nom' => 'SOW', 'prenom' => 'Moussa Alioune']);
        $this->assertDatabaseHas('journal_audit', ['user_id' => $account->id, 'action' => 'historical_import']);
    }
}
