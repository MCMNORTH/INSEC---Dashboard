<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PieceAdministrative extends Model
{
    protected $table = 'pieces_administratives';
    protected $fillable = ['etudiant_id', 'type', 'nom_original', 'chemin', 'mime_type', 'taille', 'statut', 'date_expiration', 'note'];
    protected $casts = ['date_expiration' => 'date'];
    public function etudiant() { return $this->belongsTo(Etudiant::class, 'etudiant_id'); }
}
