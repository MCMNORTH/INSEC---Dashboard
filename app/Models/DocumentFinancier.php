<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentFinancier extends Model
{
    protected $table = 'documents_financiers';

    protected $fillable = [
        'inscription_id', 'versement_id', 'type', 'numero', 'date_emission',
        'montant_total', 'montant_paye', 'solde_restant', 'details',
    ];

    protected $casts = [
        'date_emission' => 'date',
        'details' => 'array',
    ];

    public function inscription()
    {
        return $this->belongsTo(Inscription::class);
    }

    public function versement()
    {
        return $this->belongsTo(Versement::class);
    }
}
