<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inscription extends Model
{
    protected $fillable = [
        'id_etudiant', 'id_formation', 'id_annee_academique', 'annee_parcours',
        'date_inscription', 'numero_inscription_intec', 'statut', 'montant_du',
    ];

    protected $casts = [
        'date_inscription' => 'date',
    ];

    public function etudiant()
    {
        return $this->belongsTo(Etudiant::class, 'id_etudiant');
    }

    public function formation()
    {
        return $this->belongsTo(Formation::class, 'id_formation');
    }

    public function anneeAcademique()
    {
        return $this->belongsTo(AnneeAcademique::class, 'id_annee_academique');
    }

    public function versements()
    {
        return $this->hasMany(Versement::class);
    }

    public function ues()
    {
        return $this->belongsToMany(Ue::class, 'inscription_ue')
            ->withPivot('statut')
            ->withTimestamps()
            ->orderBy('ordre');
    }

    public function getTotalVerseAttribute()
    {
        return $this->versements->where('statut', 'Validée')->sum('montant');
    }

    public function getSoldeRestantAttribute()
    {
        return max($this->montant_du - $this->total_verse, 0);
    }

    public function getStatutPaiementAttribute()
    {
        if ($this->montant_du <= 0) return 'Soldé';
        if ($this->total_verse >= $this->montant_du) return 'Soldé';
        if ($this->total_verse > 0) return 'Partiel';
        return 'Impayé';
    }
}
