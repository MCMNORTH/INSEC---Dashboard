<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SimplifiedNavigationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sidebar_exposes_only_five_primary_destinations(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $response=$this->actingAs($admin)->get(route('admin.dashboard'))->assertOk();
        foreach(['Tableau de bord','Étudiants','Académique','Finances','Administration'] as $label)$response->assertSee($label);
        foreach(['Admissions','Diplômes &amp; UE','Examens &amp; résultats','Comptes &amp; accès','Imports &amp; exports','Journal d’audit'] as $label)$response->assertDontSee($label,false);
        $response->assertSee('aria-label="Alertes',false);
        $response->assertSee('sticky top-0 w-64 h-screen',false);
        $response->assertSee('images/logo-insec.png',false);
    }

    public function test_grouped_hubs_keep_all_advanced_tools_accessible(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $this->actingAs($admin)->get(route('academique.index'))->assertOk()->assertSee('Diplômes et UE')->assertSee('Enseignants')->assertSee('Examens et résultats');
        $this->actingAs($admin)->get(route('administration.index'))->assertOk()->assertSee('Comptes et accès')->assertSee('Imports et exports')->assertSee('Communications')->assertSee('Journal d’audit')->assertDontSee('Sauvegardes');
    }

    public function test_super_admin_sees_backup_tool_and_finance_keeps_a_minimal_sidebar(): void
    {
        $super=User::factory()->create(['role'=>'super_admin']);
        $this->actingAs($super)->get(route('administration.index'))->assertOk()->assertSee('Sauvegardes');
        $finance=User::factory()->create(['role'=>'finance']);
        $response=$this->actingAs($finance)->get(route('finances.index'))->assertOk()->assertSee('Tableau de bord')->assertSee('Finances')->assertDontSee('Académique')->assertDontSee('Administration');
    }
}
