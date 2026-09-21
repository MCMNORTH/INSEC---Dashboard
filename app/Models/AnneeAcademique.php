<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

class AnneeAcademique extends Model
{
    protected $table = 'annees_academiques';
    protected $fillable = ['libelle'];

    public static function libelleCourante(?CarbonInterface $date = null): string
    {
        $date ??= now();
        $debut = $date->month >= 9 ? $date->year : $date->year - 1;

        return $debut.'-'.($debut + 1);
    }

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_annee_academique');
    }
}
