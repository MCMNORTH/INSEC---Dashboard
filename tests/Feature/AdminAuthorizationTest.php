<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_from_student_management(): void
    {
        $this->get('/etudiants')->assertRedirect('/login');
    }

    public function test_non_admin_cannot_access_management_pages(): void
    {
        $user = User::factory()->create(['role' => 'enseignant']);

        $this->actingAs($user)->get('/admin/dashboard')->assertForbidden();
        $this->actingAs($user)->get('/etudiants')->assertForbidden();
        $this->actingAs($user)->get('/enseignants')->assertForbidden();
        $this->actingAs($user)->get('/finances')->assertForbidden();
    }

    public function test_admin_can_access_management_pages(): void
    {
        $user = User::factory()->create(['role' => 'admin']);

        $this->actingAs($user)->get('/admin/dashboard')->assertOk();
        $this->actingAs($user)->get('/etudiants')->assertOk();
        $this->actingAs($user)->get('/enseignants')->assertOk();
        $this->actingAs($user)->get('/finances')->assertOk();
    }

    public function test_super_admin_can_access_management_pages(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);

        $this->actingAs($user)->get('/admin/dashboard')->assertOk();
        $this->actingAs($user)->get('/etudiants')->assertOk();
        $this->actingAs($user)->get('/enseignants')->assertOk();
        $this->actingAs($user)->get('/finances')->assertOk();
    }
}
