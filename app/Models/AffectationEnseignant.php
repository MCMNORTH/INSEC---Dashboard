<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AffectationEnseignant extends Model
{
    protected $table = 'affectation_enseignant';
    protected $fillable = ['enseignant_id', 'ue_id', 'nombre_etudiants'];

    public function enseignant()
    {
        return $this->belongsTo(Enseignant::class);
    }

    public function ue()
    {
        return $this->belongsTo(Ue::class);
    }
}