<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\AnneeAcademique;
use App\Models\Inscription;

class EtudiantController extends Controller
{
    public function index(Request $request)
    {
        $query = Etudiant::with(['inscriptions.formation', 'inscriptions.anneeAcademique'])
            ->orderBy('nom');

        if ($request->filled('recherche')) {
            $recherche = $request->recherche;
            $query->where(function ($q) use ($recherche) {
                $q->where('nom', 'like', "%{$recherche}%")
                  ->orWhere('prenom', 'like', "%{$recherche}%")
                  ->orWhere('email', 'like', "%{$recherche}%");
            });
        }

        if ($request->filled('formation_id')) {
            $query->whereHas('inscriptions', function ($q) use ($request) {
                $q->where('id_formation', $request->formation_id);
            });
        }

        if ($request->filled('annee_academique_id')) {
            $query->whereHas('inscriptions', function ($q) use ($request) {
                $q->where('id_annee_academique', $request->annee_academique_id);
            });
        }

        $etudiants = $query->paginate(10)->withQueryString();
        $formations = Formation::orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();

        return view('etudiants.index', compact('etudiants', 'formations', 'annees'));
    }

    public function show(Etudiant $etudiant)
    {
        $etudiant->load(['inscriptions.formation', 'inscriptions.anneeAcademique']);
        return view('etudiants.show', compact('etudiant'));
    }

    public function create()
    {
        $formations = Formation::orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();
        return view('etudiants.create', compact('formations', 'annees'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'email' => 'required|email|unique:etudiants,email',
            'telephone' => 'nullable|string|max:30',
            'statut_etudiant' => 'required|in:Actif,Suspendu,Diplômé,Abandon',
            'formation_id' => 'required|exists:formations,id',
            'annee_academique_id' => 'required|exists:annees_academiques,id',
        ]);

        $etudiant = Etudiant::create([
            'nom' => $validated['nom'],
            'prenom' => $validated['prenom'],
            'email' => $validated['email'],
            'telephone' => $validated['telephone'] ?? null,
            'statut_etudiant' => $validated['statut_etudiant'],
        ]);

        Inscription::create([
            'id_etudiant' => $etudiant->id_etudiant,
            'id_formation' => $validated['formation_id'],
            'id_annee_academique' => $validated['annee_academique_id'],
        ]);

        return redirect()->route('etudiants.show', $etudiant)->with('status', 'Étudiant ajouté avec succès.');
    }
}