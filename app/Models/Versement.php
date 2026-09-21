<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Versement extends Model
{
    protected $fillable = ['inscription_id', 'montant', 'date_versement', 'statut', 'mode_paiement', 'reference', 'numero_recu', 'note'];

    protected $casts = ['date_versement' => 'date'];

    public function inscription()
    {
        return $this->belongsTo(Inscription::class);
    }

    public function documentFinancier()
    {
        return $this->hasOne(DocumentFinancier::class);
    }
}
