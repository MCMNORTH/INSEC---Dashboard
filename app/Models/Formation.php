<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Formation extends Model
{
    protected $fillable = [
        'code', 'nom', 'libelle', 'duree_annees', 'niveau_diplome',
        'credits_total', 'active', 'source_url', 'source_verifiee_le',
    ];

    protected $casts = [
        'active' => 'boolean',
        'source_verifiee_le' => 'date',
    ];

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_formation');
    }

    public function ues()
    {
        return $this->hasMany(Ue::class)->orderBy('annee_parcours')->orderBy('ordre');
    }
}
