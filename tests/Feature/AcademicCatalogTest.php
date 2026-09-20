<?php

namespace Tests\Feature;

use App\Models\Formation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_official_dgc_and_dsgc_catalog_is_seeded(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dgc = Formation::with('ues')->where('code', 'DGC')->firstOrFail();
        $dsgc = Formation::with('ues')->where('code', 'DSGC')->firstOrFail();

        $this->assertCount(13, $dgc->ues);
        $this->assertSame(180, $dgc->ues->sum('credits'));
        $this->assertSame([1, 2, 3], $dgc->ues->pluck('annee_parcours')->unique()->sort()->values()->all());

        $this->assertCount(7, $dsgc->ues);
        $this->assertSame(120, $dsgc->ues->sum('credits'));
        $this->assertSame([1, 2], $dsgc->ues->pluck('annee_parcours')->unique()->sort()->values()->all());
    }

    public function test_admin_can_view_academic_catalog(): void
    {
        $this->seed(DatabaseSeeder::class);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->get('/formations')
            ->assertOk()
            ->assertSee('TEC111')
            ->assertSee('TEC218')
            ->assertSee('Référentiel officiel INTEC-CNAM');
    }
}
