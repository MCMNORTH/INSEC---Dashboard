<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ue extends Model
{
    protected $fillable = [
        'formation_id', 'code', 'libelle', 'credits', 'annee_parcours', 'ordre', 'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function formation()
    {
        return $this->belongsTo(Formation::class);
    }

    public function affectations()
    {
        return $this->hasMany(AffectationEnseignant::class);
    }
}
