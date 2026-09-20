<?php
namespace Tests\Feature;

use App\Models\Etudiant;
use App\Models\JournalAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_model_changes_are_attributed_to_authenticated_user(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $this->actingAs($admin);
        $student=Etudiant::create(['nom'=>'Ba','prenom'=>'Awa','email'=>'awa@example.com','statut_etudiant'=>'Actif']);
        $student->update(['telephone'=>'22000000']);
        $creation=JournalAudit::where('modele','Etudiant')->where('modele_id',$student->id_etudiant)->where('action','created')->first();
        $modification=JournalAudit::where('modele','Etudiant')->where('action','updated')->first();
        $this->assertSame($admin->id,$creation->user_id);
        $this->assertSame('22000000',$modification->apres['telephone']);
    }

    public function test_sensitive_user_fields_are_never_stored(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $this->actingAs($admin);$admin->update(['password'=>'secret-hash']);
        $log=JournalAudit::where('modele','User')->where('action','updated')->latest()->first();
        $this->assertArrayNotHasKey('password',$log->avant??[]);
        $this->assertArrayNotHasKey('password',$log->apres??[]);
        $this->assertStringNotContainsString('secret-hash',json_encode($log->toArray()));
    }

    public function test_audit_screen_is_reserved_for_admins(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);$finance=User::factory()->create(['role'=>'finance']);
        $this->actingAs($admin)->get(route('audit.index'))->assertOk()->assertSee('Journal d’audit');
        $this->actingAs($finance)->get(route('audit.index'))->assertForbidden();
    }
}
