<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Examen;
use App\Models\Formation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($this->admin);
    }

    public function test_exam_automatically_convokes_only_eligible_students(): void
    {
        $annee = AnneeAcademique::firstOrFail();
        $dgc = Formation::where('code', 'DGC')->firstOrFail();
        $ue = $dgc->ues()->firstOrFail();
        $eligible = $this->studentEnrollment('eligible@example.com', $dgc->id, $annee->id, [$ue->id]);
        $this->studentEnrollment('autre@example.com', $dgc->id, $annee->id, [$dgc->ues()->whereKeyNot($ue->id)->firstOrFail()->id]);

        $this->post(route('examens.store'), $this->examPayload($ue->id, $annee->id))->assertRedirect();

        $examen = Examen::firstOrFail();
        $this->assertCount(1, $examen->resultats);
        $this->assertSame($eligible->id, $examen->resultats->first()->inscription_id);
    }

    public function test_note_validates_ue_and_credits(): void
    {
        $annee = AnneeAcademique::firstOrFail();
        $dgc = Formation::where('code', 'DGC')->firstOrFail();
        $ue = $dgc->ues()->firstOrFail();
        $inscription = $this->studentEnrollment('note@example.com', $dgc->id, $annee->id, [$ue->id]);
        $this->post(route('examens.store'), $this->examPayload($ue->id, $annee->id));
        $examen = Examen::firstOrFail();
        $resultat = $examen->resultats()->firstOrFail();

        $this->put(route('examens.resultats.update', [$examen, $resultat]), ['presence' => 'Présent', 'note' => 12, 'commentaire' => 'Admis'])->assertRedirect();

        $this->assertTrue($resultat->fresh()->load('examen')->valide);
        $this->assertSame($ue->credits, $inscription->fresh()->load('resultatsExamens.examen.ue')->credits_valides);
    }

    public function test_note_above_maximum_is_rejected(): void
    {
        $annee = AnneeAcademique::firstOrFail();
        $dgc = Formation::where('code', 'DGC')->firstOrFail();
        $ue = $dgc->ues()->firstOrFail();
        $this->studentEnrollment('max@example.com', $dgc->id, $annee->id, [$ue->id]);
        $this->post(route('examens.store'), $this->examPayload($ue->id, $annee->id));
        $examen = Examen::firstOrFail();
        $resultat = $examen->resultats()->firstOrFail();

        $this->from(route('examens.show', $examen))->put(route('examens.resultats.update', [$examen, $resultat]), ['presence' => 'Présent', 'note' => 21])
            ->assertRedirect(route('examens.show', $examen))->assertSessionHasErrors('note');
    }

    private function studentEnrollment(string $email, int $formation, int $annee, array $ues)
    {
        $student = Etudiant::create(['nom' => 'Test', 'prenom' => 'Étudiant', 'email' => $email, 'statut_etudiant' => 'Actif']);
        $enrollment = $student->inscriptions()->create(['id_formation' => $formation, 'id_annee_academique' => $annee, 'annee_parcours' => 1]);
        $enrollment->ues()->sync($ues);
        return $enrollment;
    }

    private function examPayload(int $ue, int $annee): array
    {
        return ['ue_id' => $ue, 'annee_academique_id' => $annee, 'session' => 'Normale', 'date_examen' => '2027-06-15 09:00:00', 'salle' => 'A1', 'note_sur' => 20, 'seuil_validation' => 10, 'statut' => 'Planifié'];
    }
}
