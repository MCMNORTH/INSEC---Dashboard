<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ResultatExamen extends Model
{
    protected $table = 'resultats_examens';
    protected $fillable = ['examen_id', 'inscription_id', 'presence', 'note', 'commentaire'];
    protected $casts = ['note' => 'float'];

    public function examen() { return $this->belongsTo(Examen::class); }
    public function inscription() { return $this->belongsTo(Inscription::class); }

    public function getValideAttribute(): bool
    {
        return $this->presence === 'Présent' && $this->note !== null && $this->note >= $this->examen->seuil_validation;
    }
}
