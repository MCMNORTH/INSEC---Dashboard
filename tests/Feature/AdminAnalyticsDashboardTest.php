<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
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
}
