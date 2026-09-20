<?php
namespace Tests\Feature;

use App\Mail\InsecNotificationMail;
use App\Models\AnneeAcademique;
use App\Models\Formation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailCommunicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_application_submission_sends_and_logs_confirmation_email(): void
    {
        Mail::fake();
        $annee=AnneeAcademique::create(['libelle'=>'2026-2027']);
        $formation=Formation::create(['code'=>'DGC','nom'=>'DGC','libelle'=>'DGC','duree_annees'=>3,'credits_total'=>180,'active'=>true]);
        $this->post(route('candidatures.store'),['nom'=>'Ba','prenom'=>'Awa','email'=>'awa@example.com','telephone'=>'22000000','dernier_diplome'=>'Bac','formation_id'=>$formation->id,'annee_academique_id'=>$annee->id])->assertRedirect();
        Mail::assertSent(InsecNotificationMail::class,fn($mail)=>$mail->hasTo('awa@example.com')&&$mail->objet==='Votre candidature INSEC a bien été reçue');
        $this->assertDatabaseHas('journal_emails',['destinataire'=>'awa@example.com','type'=>'Candidature','statut'=>'Envoyé']);
    }

    public function test_only_admin_can_view_email_audit_log(): void
    {
        $admin=User::factory()->create(['role'=>'admin']);
        $finance=User::factory()->create(['role'=>'finance']);
        $this->actingAs($admin)->get(route('communications.index'))->assertOk()->assertSee('Communications par e-mail');
        $this->actingAs($finance)->get(route('communications.index'))->assertForbidden();
    }
}
