<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inscription extends Model
{
    protected $fillable = [
        'id_etudiant', 'id_formation', 'id_annee_academique', 'annee_parcours',
        'date_inscription', 'numero_inscription_intec', 'statut', 'montant_du',
        'montant_remise', 'note_financiere', 'financeur', 'prix_vente_ue_mru',
        'cout_cnam_ue_eur', 'reference_facture_bumex', 'facture_bumex_emise_le',
    ];

    protected $casts = [
        'date_inscription' => 'date',
        'cout_cnam_ue_eur' => 'decimal:2',
        'facture_bumex_emise_le' => 'date',
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

    public function documentsFinanciers()
    {
        return $this->hasMany(DocumentFinancier::class);
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

    public function synchroniserTarification(): void
    {
        $this->loadMissing(['formation', 'ues']);
        $tarif = config('insec.tarifs_ue.'.$this->formation?->code);
        if (! $tarif) return;

        $this->update([
            'prix_vente_ue_mru' => $tarif['vente_mru'],
            'cout_cnam_ue_eur' => $tarif['cout_cnam_eur'],
            'montant_du' => $this->ues->count() * $tarif['vente_mru'],
        ]);
    }

    public function getCoutCnamTotalEurAttribute(): float
    {
        return $this->ues->count() * (float) $this->cout_cnam_ue_eur;
    }
}
