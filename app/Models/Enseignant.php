<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Enseignant extends Model
{
    protected $fillable = [
        'nom', 
        'prenom', 
        'specialite', 
        'email', 
        'telephone'
    ];

    public function affectations()
    {
        // On précise 'enseignant_id' ou 'id_enseignant' selon votre schéma
        return $this->hasMany(AffectationEnseignant::class, 'enseignant_id');
    }

    public function getNombreUeAttribute()
    {
        return $this->affectations ? $this->affectations->count() : 0;
    }

    public function getNombreEtudiantsAttribute()
    {
        return $this->affectations ? $this->affectations->sum('nombre_etudiants') : 0;
    }
}