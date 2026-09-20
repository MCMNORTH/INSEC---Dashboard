<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class JournalAudit extends Model
{
    protected $table='journal_audit';
    protected $fillable=['user_id','acteur','action','modele','modele_id','description','avant','apres','adresse_ip','user_agent','route'];
    protected $casts=['avant'=>'array','apres'=>'array'];
    public function user(){return $this->belongsTo(User::class);}
}
