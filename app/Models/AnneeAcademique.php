<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

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

    public static function contexte(Request $request): array
    {
        $courante = static::firstOrCreate(['libelle' => static::libelleCourante()]);
        $annees = static::disponibles()->orderByDesc('libelle')->get();
        $explicite = $request->filled('annee_id');
        $anneeId = $explicite
            ? $request->integer('annee_id')
            : (int) $request->session()->get('annee_academique_id', $courante->id);

        if (! $annees->contains('id', $anneeId)) {
            abort_if($explicite, 422, 'Année académique invalide.');
            $anneeId = $courante->id;
        }

        $request->session()->put('annee_academique_id', $anneeId);

        return [$annees, $anneeId];
    }

    public function inscriptions()
    {
        return $this->hasMany(Inscription::class, 'id_annee_academique');
    }
}
