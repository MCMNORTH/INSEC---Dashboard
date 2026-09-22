<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
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

    public function scopeDisponibles(Builder $query): Builder
    {
        return $query
            ->where('libelle', '>=', '2024-2025')
            ->where('libelle', '<=', static::libelleCourante());
    }

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_annee_academique');
    }
}
