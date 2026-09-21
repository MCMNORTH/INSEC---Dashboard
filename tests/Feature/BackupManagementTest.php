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
}
