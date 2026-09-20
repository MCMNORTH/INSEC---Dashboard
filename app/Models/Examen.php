<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Examen extends Model
{
    protected $fillable = ['ue_id', 'annee_academique_id', 'session', 'date_examen', 'salle', 'note_sur', 'seuil_validation', 'statut'];
    protected $casts = ['date_examen' => 'datetime', 'note_sur' => 'float', 'seuil_validation' => 'float'];

    public function ue() { return $this->belongsTo(Ue::class); }
    public function anneeAcademique() { return $this->belongsTo(AnneeAcademique::class); }
    public function resultats() { return $this->hasMany(ResultatExamen::class); }
}
