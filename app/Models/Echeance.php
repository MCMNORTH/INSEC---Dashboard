<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Echeance extends Model
{
    protected $fillable = ['inscription_id', 'libelle', 'montant', 'date_echeance'];
    protected $casts = ['date_echeance' => 'date'];

    public function inscription() { return $this->belongsTo(Inscription::class); }
}
