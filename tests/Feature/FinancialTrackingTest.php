<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\Inscription;
use App\Models\User;
use App\Models\DocumentFinancier;
use Carbon\Carbon;
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

    public function test_annual_finance_summary_defaults_to_the_current_academic_year(): void
    {
        Carbon::setTestNow('2026-09-21');
        $courante = AnneeAcademique::where('libelle', '2026-2027')->firstOrFail();

        $this->get(route('finances.index', ['tab' => 'reversement']))
            ->assertOk()
            ->assertSee('<option value="'.$courante->id.'" selected>2026-2027</option>', false);

        Carbon::setTestNow();
    }

    public function test_bumex_enrollment_keeps_normal_revenue_and_cnam_costs_separate(): void
    {
        $this->inscription->load('formation');
        $ue = $this->inscription->formation->ues()->firstOrFail();
        $this->inscription->ues()->sync([$ue->id]);
        $this->inscription->update(['financeur' => 'bumex']);
        $this->inscription->synchroniserTarification();

        $fresh = $this->inscription->fresh()->load('ues');
        $this->assertSame(16000, $fresh->montant_du);
        $this->assertSame(160.0, $fresh->cout_cnam_total_eur);
        $this->assertSame('bumex', $fresh->financeur);
    }

    public function test_cnam_forecast_uses_the_yearly_exchange_rate(): void
    {
        $annee = $this->inscription->anneeAcademique;
        $this->put(route('finances.cnam.update', $annee), [
            'taux_change_previsionnel' => 43.5, 'statut' => 'Prévisionnelle',
        ])->assertRedirect();

        $this->assertDatabaseHas('factures_cnam', [
            'annee_academique_id' => $annee->id, 'taux_change_previsionnel' => 43.5,
        ]);
    }

    public function test_validated_payment_creates_an_immutable_receipt_snapshot(): void
    {
        $this->inscription->update(['montant_du' => 100000, 'montant_remise' => 10000]);

        $this->post(route('finances.versements.store', $this->inscription), [
            'montant' => 30000, 'date_versement' => '2026-09-21', 'statut' => 'Validée',
            'mode_paiement' => 'Espèces',
        ])->assertRedirect();

        $document = DocumentFinancier::where('type', 'recu')->firstOrFail();
        $this->assertSame(90000, $document->montant_total);
        $this->assertSame(30000, $document->montant_paye);
        $this->assertSame(60000, $document->solde_restant);
        $this->assertStringStartsWith('REC-', $document->numero);

        $this->inscription->update(['montant_du' => 120000]);
        $this->assertSame(90000, $document->fresh()->montant_total);
    }

    public function test_invoice_can_be_generated_before_any_payment(): void
    {
        $this->inscription->update(['montant_du' => 64000]);
        $ues = $this->inscription->formation->ues()->orderBy('ordre')->limit(4)->get();
        $this->inscription->ues()->sync($ues->pluck('id'));

        $this->post(route('pdf.facture', $this->inscription))
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $document = DocumentFinancier::where('type', 'facture')->firstOrFail();
        $this->assertSame(64000, $document->montant_total);
        $this->assertSame(0, $document->montant_paye);
        $this->assertSame(64000, $document->solde_restant);
        $this->assertCount(4, $document->details['ues']);
        $this->assertSame($ues->first()->code, $document->details['ues'][0]['code']);
        $this->assertSame($ues->first()->libelle, $document->details['ues'][0]['libelle']);
        $this->assertStringStartsWith('FAC-', $document->numero);
    }
}
