<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnneeAcademique extends Model
{
    protected $table = 'annees_academiques';
    protected $fillable = ['libelle'];

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_annee_academique');
    }
}