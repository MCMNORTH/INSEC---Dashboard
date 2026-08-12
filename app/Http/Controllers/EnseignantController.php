<?php

namespace App\Http\Controllers;

use App\Models\Enseignant;
use App\Models\AffectationEnseignant;
use App\Models\Ue;
use Illuminate\Http\Request;

class EnseignantController extends Controller
{
    public function index()
    {
        $enseignants = Enseignant::with('affectations')
            ->orderBy('nom')
            ->paginate(10);

        return view('enseignants.index', compact('enseignants'));
    }

    public function create()
    {
        return view('enseignants.create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'specialite' => 'required|string|max:255',
            'email' => 'required|email|unique:enseignants,email',
            'telephone' => 'nullable|string|max:30',
        ]);

        Enseignant::create($validated);

        return redirect()->route('enseignants.index')->with('status', 'Enseignant ajouté avec succès.');
    }

    public function show(Enseignant $enseignant)
    {
        $enseignant->load('affectations.ue');

        $uesDisponibles = Ue::whereDoesntHave('affectations', function ($q) use ($enseignant) {
            $q->where('enseignant_id', $enseignant->id);
        })->orderBy('libelle')->get();

        return view('enseignants.show', compact('enseignant', 'uesDisponibles'));
    }

    public function edit(Enseignant $enseignant)
    {
        return view('enseignants.edit', compact('enseignant'));
    }

    public function update(Request $request, Enseignant $enseignant)
    {
        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'specialite' => 'required|string|max:255',
            'email' => 'required|email|unique:enseignants,email,' . $enseignant->id,
            'telephone' => 'nullable|string|max:30',
        ]);

        $enseignant->update($validated);

        return redirect()->route('enseignants.index')->with('status', 'Enseignant modifié avec succès.');
    }

    public function destroy(Enseignant $enseignant)
    {
        $enseignant->affectations()->delete();
        $enseignant->delete();

        return redirect()->route('enseignants.index')->with('status', 'Enseignant supprimé avec succès.');
    }

    public function storeAffectation(Request $request, Enseignant $enseignant)
    {
        $validated = $request->validate([
            'ue_id' => 'required|exists:ues,id',
            'nombre_etudiants' => 'required|integer|min:0',
        ]);

        AffectationEnseignant::firstOrCreate(
            ['enseignant_id' => $enseignant->id, 'ue_id' => $validated['ue_id']],
            ['nombre_etudiants' => $validated['nombre_etudiants']]
        );

        return redirect()->route('enseignants.show', $enseignant)->with('status', 'UE affectée avec succès.');
    }

    public function destroyAffectation(AffectationEnseignant $affectation)
    {
        $enseignant = $affectation->enseignant;
        $affectation->delete();

        return redirect()->route('enseignants.show', $enseignant)->with('status', 'Affectation retirée avec succès.');
    }
}