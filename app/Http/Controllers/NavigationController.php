<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use Illuminate\Http\Request;
use Illuminate\View\View;

class NavigationController extends Controller
{
    public function academique(Request $request): View
    {
        [$annees, $anneeId] = AnneeAcademique::contexte($request);
        $inscriptionIds = Inscription::where('id_annee_academique', $anneeId)->pluck('id');
        $statistiques = [
            'etudiants' => Inscription::where('id_annee_academique', $anneeId)->distinct('id_etudiant')->count('id_etudiant'),
            'examens' => Examen::where('annee_academique_id', $anneeId)->count(),
            'resultats' => ResultatExamen::whereIn('inscription_id', $inscriptionIds)->count(),
        ];
        return view('navigation.academique', compact('annees', 'anneeId', 'statistiques'));
    }

    public function administration(): View
    { return view('navigation.administration'); }
}
