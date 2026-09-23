<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Etudiant extends Model
{
    protected $primaryKey = 'id_etudiant';
    
    protected $fillable = [
        'nom',
        'prenom',
        'date_naissance',
        'email', 
        'telephone', 
        'statut_etudiant'
    ];

    protected $casts = ['date_naissance' => 'date'];

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_etudiant');
    }

    public function derniereInscription()
    {
        return $this->hasOne(Inscription::class, 'id_etudiant')->latestOfMany();
    }

    public function piecesAdministratives()
    {
        return $this->hasMany(PieceAdministrative::class, 'etudiant_id');
    }

    public function user() { return $this->hasOne(User::class, 'etudiant_id'); }
}
