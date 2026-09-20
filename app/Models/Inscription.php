<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inscription extends Model
{
    protected $fillable = [
        'id_etudiant', 'id_formation', 'id_annee_academique', 'annee_parcours',
        'date_inscription', 'numero_inscription_intec', 'statut', 'montant_du',
        'montant_remise', 'note_financiere',
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

    public function echeances()
    {
        return $this->hasMany(Echeance::class)->orderBy('date_echeance');
    }

    public function resultatsExamens()
    {
        return $this->hasMany(ResultatExamen::class);
    }

    public function getCreditsValidesAttribute(): int
    {
        return (int) $this->resultatsExamens->filter->valide->pluck('examen.ue')->filter()->unique('id')->sum('credits');
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
        return max($this->montant_net - $this->total_verse, 0);
    }

    public function getMontantNetAttribute()
    {
        return max($this->montant_du - $this->montant_remise, 0);
    }

    public function getStatutPaiementAttribute()
    {
        if ($this->montant_net <= 0) return 'Soldé';
        if ($this->total_verse >= $this->montant_net) return 'Soldé';
        if ($this->total_verse > 0) return 'Partiel';
        return 'Impayé';
    }

    public function getMontantEnRetardAttribute()
    {
        $exigible = $this->echeances->where('date_echeance', '<', now()->startOfDay())->sum('montant');
        return max(min($exigible, $this->montant_net) - $this->total_verse, 0);
    }
}
