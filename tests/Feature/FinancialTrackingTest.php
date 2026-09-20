<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\Inscription;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialTrackingTest extends TestCase
{
    use RefreshDatabase;

    private Inscription $inscription;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $etudiant = Etudiant::create(['nom' => 'Ba', 'prenom' => 'Mariam', 'email' => 'mariam@example.com', 'statut_etudiant' => 'Actif']);
        $this->inscription = $etudiant->inscriptions()->create([
            'id_formation' => Formation::where('code', 'DGC')->value('id'),
            'id_annee_academique' => AnneeAcademique::first()->id,
            'annee_parcours' => 1,
        ]);
    }

    public function test_discount_payment_and_balance_are_calculated_per_enrollment(): void
    {
        $this->put(route('finances.inscriptions.update', $this->inscription), [
            'montant_du' => 100000, 'montant_remise' => 10000, 'note_financiere' => 'Remise direction',
        ])->assertRedirect();

        $this->post(route('finances.versements.store', $this->inscription), [
            'montant' => 30000, 'date_versement' => '2026-09-20', 'statut' => 'Validée',
            'mode_paiement' => 'Virement', 'reference' => 'VIR-42',
        ])->assertRedirect();

        $fresh = $this->inscription->fresh()->load(['versements', 'echeances']);
        $this->assertSame(90000, $fresh->montant_net);
        $this->assertSame(60000, $fresh->solde_restant);
        $this->assertSame('REC-202609-000001', $fresh->versements->first()->numero_recu);
    }

    public function test_pending_payment_is_not_counted_as_paid(): void
    {
        $this->inscription->update(['montant_du' => 50000]);
        $this->inscription->versements()->create(['montant' => 50000, 'date_versement' => '2026-09-20', 'statut' => 'En attente']);
        $this->assertSame(50000, $this->inscription->fresh()->load('versements')->solde_restant);
    }

    public function test_overdue_installment_is_reported(): void
    {
        $this->inscription->update(['montant_du' => 100000]);
        $this->post(route('finances.echeances.store', $this->inscription), ['libelle' => 'Première tranche', 'montant' => 40000, 'date_echeance' => '2025-01-01'])->assertRedirect();
        $this->assertSame(40000, $this->inscription->fresh()->load(['echeances', 'versements'])->montant_en_retard);
    }

    public function test_payment_cannot_be_attached_to_another_students_latest_enrollment(): void
    {
        $other = Etudiant::create(['nom' => 'Fall', 'prenom' => 'Oumar', 'email' => 'oumar@example.com', 'statut_etudiant' => 'Actif']);
        $otherEnrollment = $other->inscriptions()->create(['id_formation' => $this->inscription->id_formation, 'id_annee_academique' => $this->inscription->id_annee_academique]);

        $this->post(route('finances.versements.store', $this->inscription), ['montant' => 1000, 'date_versement' => '2026-09-20', 'statut' => 'Validée', 'mode_paiement' => 'Espèces'])->assertRedirect();

        $this->assertCount(1, $this->inscription->fresh()->versements);
        $this->assertCount(0, $otherEnrollment->fresh()->versements);
    }
}
