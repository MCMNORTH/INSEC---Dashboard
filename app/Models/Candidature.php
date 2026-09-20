<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Candidature extends Model
{
    protected $fillable = ['reference','nom','prenom','email','telephone','date_naissance','dernier_diplome','formation_id','annee_academique_id','motivation','statut','note_interne','etudiant_id','traitee_at'];
    protected $casts = ['date_naissance'=>'date','traitee_at'=>'datetime'];
    public function formation(){ return $this->belongsTo(Formation::class); }
    public function anneeAcademique(){ return $this->belongsTo(AnneeAcademique::class); }
    public function etudiant(){ return $this->belongsTo(Etudiant::class,'etudiant_id'); }
}
