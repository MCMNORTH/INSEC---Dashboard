<?php

namespace Tests\Feature;

use App\Models\Alerte;
use App\Models\Etudiant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertCenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_roles_can_open_their_alert_center(): void
    {
        foreach (['admin', 'finance'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))->get('/alertes')->assertOk()->assertSee('Centre d’alertes');
        }
    }

    public function test_student_cannot_read_another_users_alert(): void
    {
        $student = Etudiant::create(['nom' => 'Ba', 'prenom' => 'Awa', 'email' => 'awa@example.com', 'statut_etudiant' => 'Actif']);
        $studentUser = User::factory()->create(['role' => 'etudiant', 'etudiant_id' => $student->id_etudiant]);
        $owner = User::factory()->create(['role' => 'finance']);
        $alert = Alerte::create(['user_id' => $owner->id, 'cle' => 'secret', 'type' => 'finance', 'niveau' => 'danger', 'titre' => 'Privée', 'message' => 'Confidentiel']);
        $this->actingAs($studentUser)->put(route('alertes.lire', $alert))->assertForbidden();
    }

    public function test_user_can_mark_and_archive_own_alert(): void
    {
        $user = User::factory()->create(['role' => 'finance']);
        $alert = Alerte::create(['user_id' => $user->id, 'cle' => 'test', 'type' => 'finance', 'niveau' => 'warning', 'titre' => 'Test', 'message' => 'Message']);
        $this->actingAs($user)->put(route('alertes.lire', $alert))->assertRedirect();
        $this->assertNotNull($alert->fresh()->lue_at);
        $this->actingAs($user)->put(route('alertes.archiver', $alert))->assertRedirect();
        $this->assertNotNull($alert->fresh()->archivee_at);
    }
}
