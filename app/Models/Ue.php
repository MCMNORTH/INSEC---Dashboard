<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ue extends Model
{
    protected $fillable = ['code', 'libelle', 'credits'];

    public function affectations()
    {
        return $this->hasMany(AffectationEnseignant::class);
    }
}