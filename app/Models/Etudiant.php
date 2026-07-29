<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Etudiant extends Model
{
    protected $primaryKey = 'id_etudiant';
    protected $fillable = ['nom', 'prenom', 'email', 'telephone', 'statut_etudiant'];

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_etudiant');
    }
}