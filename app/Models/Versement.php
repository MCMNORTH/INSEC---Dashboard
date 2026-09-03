<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Versement extends Model
{
    protected $fillable = ['inscription_id', 'montant', 'date_versement', 'statut'];

    public function inscription()
    {
        return $this->belongsTo(Inscription::class);
    }
}