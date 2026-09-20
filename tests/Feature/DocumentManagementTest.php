<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentManagementTest extends TestCase
{
    use RefreshDatabase;

    private Etudiant $etudiant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->etudiant = Etudiant::create(['nom' => 'Camara', 'prenom' => 'Aïcha', 'email' => 'aicha@example.com', 'statut_etudiant' => 'Actif']);
    }

    public function test_admin_can_upload_and_validate_an_administrative_document(): void
    {
        Storage::fake('local');
        $this->post(route('etudiants.documents.store', $this->etudiant), [
            'type' => 'Pièce d’identité', 'fichier' => UploadedFile::fake()->create('identite.pdf', 120, 'application/pdf'),
        ])->assertRedirect();
        $piece = $this->etudiant->piecesAdministratives()->firstOrFail();
        Storage::disk('local')->assertExists($piece->chemin);
        $this->put(route('documents.update', $piece), ['statut' => 'Validé', 'note' => 'Conforme'])->assertRedirect();
        $this->assertSame('Validé', $piece->fresh()->statut);
    }

    public function test_attestation_and_transcript_are_real_pdfs(): void
    {
        $formation = Formation::where('code', 'DGC')->firstOrFail();
        $inscription = $this->etudiant->inscriptions()->create(['id_formation' => $formation->id, 'id_annee_academique' => AnneeAcademique::first()->id, 'annee_parcours' => 1]);
        $inscription->ues()->sync($formation->ues()->where('annee_parcours', 1)->pluck('ues.id'));

        $this->get(route('pdf.attestation', $inscription))->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->get(route('pdf.releve', $inscription))->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_non_pdf_or_image_upload_is_rejected(): void
    {
        Storage::fake('local');
        $this->from(route('etudiants.documents.index', $this->etudiant))->post(route('etudiants.documents.store', $this->etudiant), [
            'type' => 'Autre', 'fichier' => UploadedFile::fake()->create('programme.exe', 5, 'application/octet-stream'),
        ])->assertRedirect()->assertSessionHasErrors('fichier');
    }
}
