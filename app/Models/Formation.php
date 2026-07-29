<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Formation extends Model
{
    protected $fillable = ['nom', 'libelle'];

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_formation');
    }
}