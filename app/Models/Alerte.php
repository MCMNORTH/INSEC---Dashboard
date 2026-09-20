<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Alerte extends Model
{
    protected $fillable = ['user_id', 'cle', 'type', 'niveau', 'titre', 'message', 'lien', 'active', 'lue_at', 'archivee_at'];

    protected $casts = [
        'active' => 'boolean',
        'lue_at' => 'datetime',
        'archivee_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class); }
}
