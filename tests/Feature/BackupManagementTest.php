<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BackupManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/backups'));
        parent::tearDown();
    }

    public function test_only_super_admin_can_manage_backups(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $superAdmin=User::factory()->create(['role'=>'super_admin']);
        $this->actingAs($admin)->get(route('backups.index'))->assertForbidden();
        $this->actingAs($superAdmin)->get(route('backups.index'))->assertOk()->assertSee('Sauvegardes et restauration');
    }

    public function test_restore_requires_password_and_explicit_confirmation(): void
    {
        $user=User::factory()->create(['role'=>'super_admin','password'=>bcrypt('secret-test')]);
        File::ensureDirectoryExists(storage_path('app/backups'));File::put(storage_path('app/backups/insec-test.zip'),'archive-test');
        $this->actingAs($user)->post(route('backups.restore','insec-test.zip'),['password'=>'incorrect','confirmation'=>'RESTAURER'])->assertStatus(422);
        $this->actingAs($user)->post(route('backups.restore','insec-test.zip'),['password'=>'secret-test','confirmation'=>'NON'])->assertSessionHasErrors('confirmation');
    }

    public function test_owner_requested_promotion_changes_only_owner_and_preserves_password(): void
    {
        $owner = User::factory()->create(['email' => 'mohamed.cheikh@bumex.mr', 'role' => 'admin']);
        $other = User::factory()->create(['role' => 'admin']);
        $password = $owner->password;
        $migration = require database_path('migrations/2026_09_23_000019_grant_owner_super_admin.php');
        $migration->up();$migration->up();
        $this->assertSame('super_admin', $owner->fresh()->role);
        $this->assertSame($password, $owner->fresh()->password);
        $this->assertSame('admin', $other->fresh()->role);
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('journal_audit')->where('action', 'role_change')->count());
        $this->actingAs($owner->fresh())->get(route('backups.index'))->assertOk();
    }
}
