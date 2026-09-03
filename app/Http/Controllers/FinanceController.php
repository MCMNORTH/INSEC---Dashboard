<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Etudiant;
use App\Models\Inscription;
use App\Models\AnneeAcademique;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        $etudiants = Etudiant::with(['inscriptions.versements'])->orderBy('nom')->get();

        $etudiantSelectionne = null;
        $inscriptionSelectionnee = null;

        if ($request->filled('etudiant')) {
            $etudiantSelectionne = Etudiant::with('inscriptions.versements')->find($request->query('etudiant'));
            $inscriptionSelectionnee = $etudiantSelectionne ? $etudiantSelectionne->inscriptions->last() : null;
        }

        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();

        $anneeSelectionneeId = $request->filled('annee_reversement')
            ? (int) $request->query('annee_reversement')
            : ($annees->first() ? $annees->first()->id : null);

        $anneesReversement = $annees->map(function ($annee) {
            $inscriptions = Inscription::where('id_annee_academique', $annee->id)->with('versements')->get();
            $montantDu = $inscriptions->sum('montant_du');
            $reverse = $inscriptions->sum(fn($i) => $i->total_verse);

            return (object) [
                'id' => $annee->id,
                'libelle' => $annee->libelle,
                'nb_etudiants' => $inscriptions->count(),
                'montant_du' => $montantDu,
                'reverse' => $reverse,
                'statut' => $montantDu > 0 && $reverse >= $montantDu ? 'Soldé' : ($reverse > 0 ? 'Partiel' : 'Impayé'),
            ];
        });

        $anneesAvecDonnees = $anneesReversement->filter(fn($a) => $a->nb_etudiants > 0)->values();
        $carteReversement = $anneesReversement->firstWhere('id', $anneeSelectionneeId);

        return view('finances.index', compact(
            'etudiants', 'etudiantSelectionne', 'inscriptionSelectionnee',
            'annees', 'anneesAvecDonnees', 'anneeSelectionneeId', 'carteReversement'
        ));
    }

    public function updateMontant(Request $request, Etudiant $etudiant)
    {
        $validated = $request->validate([
            'montant_du' => 'required|integer|min:0',
        ]);

        $inscription = $etudiant->inscriptions()->latest()->first();
        if (!$inscription) {
            return back()->with('error', "Cet étudiant n'a pas encore d'inscription (formation/année). Assignez-en une d'abord.");
        }

        $inscription->update(['montant_du' => $validated['montant_du']]);

        return redirect()->route('finances.index', ['etudiant' => $etudiant->id_etudiant])->with('status', 'Montant dû mis à jour.');
    }

    public function storeVersement(Request $request, Etudiant $etudiant)
    {
        $validated = $request->validate([
            'montant' => 'required|integer|min:1',
            'date_versement' => 'required|date',
            'statut' => 'required|in:Validée,En attente',
        ]);

        $inscription = $etudiant->inscriptions()->latest()->first();
        if (!$inscription) {
            return back()->with('error', "Cet étudiant n'a pas encore d'inscription (formation/année).");
        }

        $inscription->versements()->create($validated);

        return redirect()->route('finances.index', ['etudiant' => $etudiant->id_etudiant])->with('status', 'Versement ajouté.');
    }
}