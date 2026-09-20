<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use App\Models\Ue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExamenController extends Controller
{
    public function index(Request $request)
    {
        $examens = Examen::with(['ue.formation', 'anneeAcademique'])->withCount('resultats')
            ->when($request->filled('annee_id'), fn ($q) => $q->where('annee_academique_id', $request->input('annee_id')))
            ->orderByDesc('date_examen')->paginate(15)->withQueryString();
        $annees = AnneeAcademique::orderByDesc('libelle')->get();
        return view('examens.index', compact('examens', 'annees'));
    }

    public function create()
    {
        $ues = Ue::with('formation')->where('active', true)->orderBy('code')->get();
        $annees = AnneeAcademique::orderByDesc('libelle')->get();
        return view('examens.create', compact('ues', 'annees'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'ue_id' => ['required', 'exists:ues,id'], 'annee_academique_id' => ['required', 'exists:annees_academiques,id'],
            'session' => ['required', 'in:Normale,Rattrapage'], 'date_examen' => ['required', 'date'],
            'salle' => ['nullable', 'string', 'max:100'], 'note_sur' => ['required', 'numeric', 'gt:0', 'max:100'],
            'seuil_validation' => ['required', 'numeric', 'min:0', 'lte:note_sur'], 'statut' => ['required', 'in:Planifié,Terminé,Annulé'],
        ]);
        $examen = DB::transaction(function () use ($validated) {
            $examen = Examen::create($validated);
            $eligible = Inscription::where('id_annee_academique', $validated['annee_academique_id'])
                ->whereHas('ues', fn ($q) => $q->where('ues.id', $validated['ue_id']))->pluck('id');
            $examen->resultats()->createMany($eligible->map(fn ($id) => ['inscription_id' => $id, 'presence' => 'Convoqué'])->all());
            return $examen;
        });
        return redirect()->route('examens.show', $examen)->with('status', 'Examen créé et étudiants éligibles convoqués.');
    }

    public function show(Examen $examen)
    {
        $examen->load(['ue.formation', 'anneeAcademique', 'resultats.inscription.etudiant']);
        return view('examens.show', compact('examen'));
    }

    public function updateResultat(Request $request, Examen $examen, ResultatExamen $resultat)
    {
        abort_unless($resultat->examen_id === $examen->id, 404);
        $validated = $request->validate(['presence' => ['required', 'in:Convoqué,Présent,Absent,Dispensé'], 'note' => ['nullable', 'numeric', 'min:0'], 'commentaire' => ['nullable', 'string', 'max:1000']]);
        if ($validated['presence'] === 'Présent' && ! isset($validated['note'])) {
            throw ValidationException::withMessages(['note' => 'Une note est obligatoire pour un étudiant présent.']);
        }
        if (isset($validated['note']) && $validated['note'] > $examen->note_sur) {
            throw ValidationException::withMessages(['note' => "La note ne peut pas dépasser {$examen->note_sur}."]);
        }
        if ($validated['presence'] !== 'Présent') $validated['note'] = null;
        $resultat->update($validated);
        return redirect()->route('examens.show', $examen)->with('status', 'Résultat enregistré.');
    }
}
