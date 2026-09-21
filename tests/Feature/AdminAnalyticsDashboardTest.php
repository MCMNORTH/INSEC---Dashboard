<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use Carbon\Carbon;
use App\Models\Formation;
use App\Models\Inscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAnalyticsDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_dashboard_displays_decision_indicators(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $annee = AnneeAcademique::create(['libelle' => '2026-2027']);
        $formation = Formation::create(['code' => 'DGC', 'nom' => 'DGC', 'libelle' => 'Diplôme de gestion et de comptabilité', 'duree_annees' => 3, 'credits_total' => 180, 'active' => true]);
        $this->actingAs($admin)->get(route('admin.dashboard', ['annee_id' => $annee->id]))
            ->assertOk()->assertSee('Tableau de bord décisionnel')->assertSee('Taux recouvrement')->assertSee('Performance par diplôme')->assertSee('Dossiers financiers à suivre');
    }

    public function test_dashboard_rejects_unknown_academic_year(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get(route('admin.dashboard', ['annee_id' => 999999]))->assertUnprocessable();
    }

    public function test_dashboard_selects_and_creates_the_current_academic_year_automatically(): void
    {
        Carbon::setTestNow('2026-09-21');
        $admin = User::factory()->create(['role' => 'admin']);
        AnneeAcademique::create(['libelle' => '2027-2028']);

        $this->actingAs($admin)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertSee('<option value="2" selected>2026-2027</option>', false);

        $this->assertDatabaseHas('annees_academiques', ['libelle' => '2026-2027']);
        Carbon::setTestNow();
    }

    public function test_academic_year_rolls_over_each_september(): void
    {
        $this->assertSame('2026-2027', AnneeAcademique::libelleCourante(Carbon::parse('2027-08-31')));
        $this->assertSame('2027-2028', AnneeAcademique::libelleCourante(Carbon::parse('2027-09-01')));
    }
}
