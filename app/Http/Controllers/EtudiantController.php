<?php

namespace App\Http\Controllers;

use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\AnneeAcademique;
use App\Models\Inscription;
use Illuminate\Http\Request;

class EtudiantController extends Controller
{
    public function index(Request $request)
    {
        // 1. Initialiser la requête avec les relations pour éviter le N+1
        $query = Etudiant::with(['inscriptions.formation', 'inscriptions.anneeAcademique']);

        // 2. Filtre par barre de recherche (Nom, Prénom ou Email)
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('nom', 'like', "%{$search}%")
                  ->orWhere('prenom', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // 3. Filtre par Formation
        if ($request->filled('formation_id')) {
            $formationId = $request->input('formation_id');
            $query->whereHas('inscriptions', function ($q) use ($formationId) {
                $q->where('id_formation', $formationId);
            });
        }

        // 4. Filtre par Année Académique
        if ($request->filled('annee_id')) {
            $anneeId = $request->input('annee_id');
            $query->whereHas('inscriptions', function ($q) use ($anneeId) {
                $q->where('id_annee_academique', $anneeId);
            });
        }

        // 5. Récupération des étudiants filtrés avec pagination (et conservation des filtres dans les liens)
        $etudiants = $query->orderBy('nom')->paginate(10)->withQueryString();

        // 6. Récupération des listes pour les menus déroulants
        $formations = Formation::orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();

        return view('etudiants.index', compact('etudiants', 'formations', 'annees'));
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

        return redirect()->route('etudiants.index')->with('status', 'Étudiant ajouté avec succès.');
    }

    public function show(Etudiant $etudiant)
    {
    $etudiant->load(['inscriptions.formation', 'inscriptions.anneeAcademique']);
    return view('etudiants.show', compact('etudiant'));
    }

    public function edit(Etudiant $etudiant)
    {
        $etudiant->load('inscriptions');
        $formations = Formation::orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();

        return view('etudiants.edit', compact('etudiant', 'formations', 'annees'));
    }

    public function update(Request $request, Etudiant $etudiant)
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'email' => 'required|email|unique:etudiants,email,' . $etudiant->id_etudiant . ',id_etudiant',
            'telephone' => 'nullable|string|max:30',
            'statut_etudiant' => 'required|in:Actif,Suspendu,Diplômé,Abandon',
            'formation_id' => 'required|exists:formations,id',
            'annee_academique_id' => 'required|exists:annees_academiques,id',
        ]);

        $etudiant->update([
            'nom' => $validated['nom'],
            'prenom' => $validated['prenom'],
            'email' => $validated['email'],
            'telephone' => $validated['telephone'] ?? null,
            'statut_etudiant' => $validated['statut_etudiant'],
        ]);

        $inscription = $etudiant->inscriptions()->latest()->first();
        
        if ($inscription) {
            $inscription->update([
                'id_formation' => $validated['formation_id'],
                'id_annee_academique' => $validated['annee_academique_id'],
            ]);
        } else {
            Inscription::create([
                'id_etudiant' => $etudiant->id_etudiant,
                'id_formation' => $validated['formation_id'],
                'id_annee_academique' => $validated['annee_academique_id'],
            ]);
        }

        return redirect()->route('etudiants.index')->with('status', 'Étudiant modifié avec succès.');
    }

    public function destroy(Etudiant $etudiant)
    {
    $aUnHistoriqueFinancier = $etudiant->inscriptions()->whereHas('versements')->exists();

    if ($aUnHistoriqueFinancier) {
        return redirect()->route('etudiants.index')->with('error', "Impossible de supprimer cet étudiant : un historique financier existe.");
    }

    $etudiant->delete();

    return redirect()->route('etudiants.index')->with('status', 'Étudiant supprimé.');
    }
}