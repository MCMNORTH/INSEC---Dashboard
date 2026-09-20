<?php

namespace Tests\Feature;

use App\Models\AnneeAcademique;
use App\Models\Candidature;
use App\Models\Formation;
use App\Models\Ue;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdmissionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function catalogue(): array
    {
        $annee=AnneeAcademique::create(['libelle'=>'2026-2027']);
        $formation=Formation::create(['code'=>'DGC','nom'=>'DGC','libelle'=>'Diplôme de gestion et de comptabilité','duree_annees'=>3,'credits_total'=>180,'active'=>true]);
        $ue=Ue::create(['formation_id'=>$formation->id,'code'=>'DGC101','libelle'=>'Fondamentaux','credits'=>14,'annee_parcours'=>1,'ordre'=>1,'active'=>true]);
        return compact('annee','formation','ue');
    }

    public function test_candidate_can_submit_a_public_application(): void
    {
        ['annee'=>$annee,'formation'=>$formation]=$this->catalogue();
        $response=$this->post(route('candidatures.store'),['nom'=>'Ba','prenom'=>'Awa','email'=>'awa@example.com','telephone'=>'22000000','dernier_diplome'=>'Baccalauréat','formation_id'=>$formation->id,'annee_academique_id'=>$annee->id,'motivation'=>'Je souhaite intégrer le DGC.']);
        $candidature=Candidature::first();
        $response->assertRedirect(route('candidatures.confirmation',$candidature->reference));
        $this->assertDatabaseHas('candidatures',['email'=>'awa@example.com','statut'=>'Nouvelle']);
    }

    public function test_admin_converts_an_admissible_application_into_enrollment(): void
    {
        ['annee'=>$annee,'formation'=>$formation,'ue'=>$ue]=$this->catalogue();
        $admin=User::factory()->create(['role'=>'admin']);
        $candidature=Candidature::create(['reference'=>'ADM-TEST01','nom'=>'Ba','prenom'=>'Awa','email'=>'awa@example.com','telephone'=>'22000000','dernier_diplome'=>'Baccalauréat','formation_id'=>$formation->id,'annee_academique_id'=>$annee->id,'statut'=>'Admissible']);
        $this->actingAs($admin)->post(route('candidatures.convertir',$candidature),['annee_parcours'=>1,'date_inscription'=>'2026-09-20','numero_inscription_intec'=>'INTEC-001','montant_du'=>50000])->assertRedirect();
        $this->assertDatabaseHas('etudiants',['email'=>'awa@example.com']);
        $this->assertDatabaseHas('inscriptions',['id_formation'=>$formation->id,'montant_du'=>50000]);
        $this->assertDatabaseHas('inscription_ue',['ue_id'=>$ue->id]);
        $this->assertSame('Inscrite',$candidature->fresh()->statut);
    }

    public function test_non_admissible_application_cannot_be_converted(): void
    {
        ['annee'=>$annee,'formation'=>$formation]=$this->catalogue();
        $admin=User::factory()->create(['role'=>'admin']);
        $c=Candidature::create(['reference'=>'ADM-TEST02','nom'=>'Sy','prenom'=>'Ali','email'=>'ali@example.com','telephone'=>'33000000','dernier_diplome'=>'Bac','formation_id'=>$formation->id,'annee_academique_id'=>$annee->id,'statut'=>'Nouvelle']);
        $this->actingAs($admin)->post(route('candidatures.convertir',$c),['annee_parcours'=>1,'date_inscription'=>'2026-09-20','montant_du'=>50000])->assertUnprocessable();
        $this->assertDatabaseMissing('etudiants',['email'=>'ali@example.com']);
    }
}
