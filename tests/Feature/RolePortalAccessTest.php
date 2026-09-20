<?php

namespace Tests\Feature;

use App\Models\Enseignant;
use App\Models\Etudiant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePortalAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_user_only_accesses_finance_scope(): void
    {
        $user = User::factory()->create(['role' => 'finance']);
        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('finances.index'));
        $this->actingAs($user)->get('/finances')->assertOk();
        $this->actingAs($user)->get('/etudiants')->assertForbidden();
        $this->actingAs($user)->get('/examens')->assertForbidden();
        $this->actingAs($user)->get('/comptes')->assertForbidden();
    }

    public function test_student_only_sees_linked_student_portal(): void
    {
        $student = Etudiant::create(['nom' => 'Ba', 'prenom' => 'Mariam', 'email' => 'mariam@example.com', 'statut_etudiant' => 'Actif']);
        $user = User::factory()->create(['role' => 'etudiant', 'etudiant_id' => $student->id_etudiant]);
        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('portail.etudiant'));
        $this->actingAs($user)->get('/portail/etudiant')->assertOk()->assertSee('Mariam');
        $this->actingAs($user)->get('/finances')->assertForbidden();
        $this->actingAs($user)->get('/portail/enseignant')->assertForbidden();
    }

    public function test_teacher_only_sees_linked_teacher_portal(): void
    {
        $teacher = Enseignant::create(['nom' => 'Fall', 'prenom' => 'Oumar', 'specialite' => 'Comptabilité', 'email' => 'oumar@example.com']);
        $user = User::factory()->create(['role' => 'enseignant', 'enseignant_id' => $teacher->id]);
        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('portail.enseignant'));
        $this->actingAs($user)->get('/portail/enseignant')->assertOk()->assertSee('Oumar');
        $this->actingAs($user)->get('/etudiants')->assertForbidden();
        $this->actingAs($user)->get('/portail/etudiant')->assertForbidden();
    }

    public function test_disabled_user_cannot_pass_role_middleware(): void
    {
        $user = User::factory()->create(['role' => 'finance', 'active' => false]);
        $this->actingAs($user)->get('/finances')->assertForbidden();
    }

    public function test_admin_can_create_linked_student_account(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = Etudiant::create(['nom' => 'Sy', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'statut_etudiant' => 'Actif']);
        $this->actingAs($admin)->post(route('comptes.store'), [
            'name' => 'Awa Sy', 'email' => 'acces.awa@example.com', 'role' => 'etudiant', 'etudiant_id' => $student->id_etudiant,
            'password' => 'MotDePasse123!', 'password_confirmation' => 'MotDePasse123!',
        ])->assertRedirect(route('comptes.index'));
        $this->assertDatabaseHas('users', ['email' => 'acces.awa@example.com', 'role' => 'etudiant', 'etudiant_id' => $student->id_etudiant]);
    }
}
