<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FactureCnam extends Model
{
    protected $table = 'factures_cnam';

    protected $fillable = [
        'annee_academique_id', 'taux_change_previsionnel', 'montant_reel_eur',
        'taux_change_reglement', 'date_reception', 'date_echeance', 'date_reglement',
        'statut', 'reference', 'note',
    ];

    protected $casts = [
        'taux_change_previsionnel' => 'decimal:4',
        'montant_reel_eur' => 'decimal:2',
        'taux_change_reglement' => 'decimal:4',
        'date_reception' => 'date', 'date_echeance' => 'date', 'date_reglement' => 'date',
    ];

    public function anneeAcademique()
    {
        return $this->belongsTo(AnneeAcademique::class);
    }
}
