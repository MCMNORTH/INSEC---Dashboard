<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class JournalEmail extends Model
{
    protected $table='journal_emails';
    protected $fillable=['destinataire','nom_destinataire','type','sujet','statut','erreur','envoye_at'];
    protected $casts=['envoye_at'=>'datetime'];
}
