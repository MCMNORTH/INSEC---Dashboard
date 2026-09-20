<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentEnrollmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    public function test_admin_creates_student_with_compatible_ues(): void
    {
        [$dgc, $annee] = $this->catalog();
        $ues = $dgc->ues()->where('annee_parcours', 1)->pluck('ues.id')->all();

        $this->post(route('etudiants.store'), $this->studentPayload($dgc, $annee, $ues))->assertRedirect();

        $etudiant = Etudiant::where('email', 'awa@example.com')->firstOrFail();
        $this->assertCount(1, $etudiant->inscriptions);
        $this->assertSame($ues, $etudiant->inscriptions->first()->ues()->pluck('ues.id')->all());
    }

    public function test_incompatible_ue_is_rejected(): void
    {
        [$dgc, $annee] = $this->catalog();
        $dsgcUe = Formation::where('code', 'DSGC')->firstOrFail()->ues()->firstOrFail();

        $this->from(route('etudiants.create'))->post(route('etudiants.store'), $this->studentPayload($dgc, $annee, [$dsgcUe->id]))
            ->assertRedirect(route('etudiants.create'))->assertSessionHasErrors('ue_ids');
        $this->assertDatabaseMissing('etudiants', ['email' => 'awa@example.com']);
    }

    public function test_second_enrollment_preserves_first(): void
    {
        [$dgc, $annee] = $this->catalog();
        $etudiant = Etudiant::create(['nom' => 'Diallo', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'statut_etudiant' => 'Actif']);
        $first = $etudiant->inscriptions()->create(['id_formation' => $dgc->id, 'id_annee_academique' => $annee->id, 'annee_parcours' => 1, 'date_inscription' => '2025-09-01']);
        $first->ues()->sync($dgc->ues()->where('annee_parcours', 1)->pluck('ues.id'));

        $ues2 = $dgc->ues()->where('annee_parcours', 2)->pluck('ues.id')->all();
        $this->post(route('etudiants.inscriptions.store', $etudiant), $this->enrollmentPayload($dgc, $annee, 2, $ues2))->assertRedirect(route('etudiants.show', $etudiant));

        $this->assertCount(2, $etudiant->fresh()->inscriptions);
        $this->assertDatabaseHas('inscriptions', ['id' => $first->id, 'annee_parcours' => 1]);
    }

    public function test_identity_update_does_not_change_enrollment(): void
    {
        [$dgc, $annee] = $this->catalog();
        $etudiant = Etudiant::create(['nom' => 'Diallo', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'statut_etudiant' => 'Actif']);
        $inscription = $etudiant->inscriptions()->create(['id_formation' => $dgc->id, 'id_annee_academique' => $annee->id, 'annee_parcours' => 1]);

        $this->put(route('etudiants.update', $etudiant), ['nom' => 'Ba', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'telephone' => '', 'statut_etudiant' => 'Actif'])->assertRedirect();

        $this->assertSame(1, $inscription->fresh()->annee_parcours);
        $this->assertSame($dgc->id, $inscription->fresh()->id_formation);
    }

    private function catalog(): array
    {
        return [Formation::where('code', 'DGC')->firstOrFail(), AnneeAcademique::firstOrFail()];
    }

    private function studentPayload(Formation $formation, AnneeAcademique $annee, array $ues): array
    {
        return array_merge(['nom' => 'Diallo', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'telephone' => '', 'statut_etudiant' => 'Actif'], $this->enrollmentPayload($formation, $annee, 1, $ues));
    }

    private function enrollmentPayload(Formation $formation, AnneeAcademique $annee, int $year, array $ues): array
    {
        return ['formation_id' => $formation->id, 'annee_academique_id' => $annee->id, 'annee_parcours' => $year,
            'date_inscription' => '2026-09-20', 'numero_inscription_intec' => 'INTEC-001', 'statut' => 'active', 'ue_ids' => $ues];
    }
}
