<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\Inscription;
use App\Models\Ue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InscriptionController extends Controller
{
    public function create(Request $request, Etudiant $etudiant)
    {
        $formations = Formation::with('ues')->where('active', true)->orderBy('nom')->get();
        [$annees, $anneeId] = AnneeAcademique::contexte($request);
        return view('inscriptions.create', compact('etudiant', 'formations', 'annees', 'anneeId'));
    }

    public function store(Request $request, Etudiant $etudiant)
    {
        $validated = $this->validated($request);
        DB::transaction(function () use ($etudiant, $validated) {
            $inscription = $etudiant->inscriptions()->create($this->attributes($validated));
            $inscription->ues()->sync($validated['ue_ids']);
            $inscription->synchroniserTarification();
        });
        return redirect()->route('etudiants.show', $etudiant)->with('status', 'Nouvelle inscription ajoutée ; l’historique précédent est conservé.');
    }

    public function edit(Inscription $inscription)
    {
        $inscription->load(['etudiant', 'formation.ues', 'anneeAcademique', 'ues']);
        $formations = Formation::with('ues')->where('active', true)->orderBy('nom')->get();
        $annees = AnneeAcademique::disponibles()->orderByDesc('libelle')->get();
        return view('inscriptions.edit', compact('inscription', 'formations', 'annees'));
    }

    public function update(Request $request, Inscription $inscription)
    {
        $validated = $this->validated($request);
        DB::transaction(function () use ($inscription, $validated) {
            $inscription->update($this->attributes($validated));
            $inscription->ues()->sync($validated['ue_ids']);
            $inscription->synchroniserTarification();
        });
        return redirect()->route('etudiants.show', $inscription->id_etudiant)->with('status', 'Inscription mise à jour.');
    }

    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'formation_id' => ['required', 'exists:formations,id'], 'annee_academique_id' => ['required', 'exists:annees_academiques,id'],
            'annee_parcours' => ['required', 'integer', 'min:1'], 'date_inscription' => ['required', 'date'],
            'numero_inscription_intec' => ['nullable', 'string', 'max:100'],
            'statut' => ['required', 'in:active,terminée,annulée,suspendue'], 'ue_ids' => ['required', 'array', 'min:1'],
            'financeur' => ['nullable', 'in:etudiant,bumex'],
            'ue_ids.*' => ['integer', 'distinct', 'exists:ues,id'],
        ]);
        $formation = Formation::findOrFail($validated['formation_id']);
        $count = Ue::where('formation_id', $formation->id)->where('annee_parcours', $validated['annee_parcours'])->whereIn('id', $validated['ue_ids'])->count();
        if ($validated['annee_parcours'] > $formation->duree_annees || $count !== count($validated['ue_ids'])) {
            throw ValidationException::withMessages(['ue_ids' => 'Les UE choisies doivent appartenir au diplôme et à l’année de parcours sélectionnés.']);
        }
        return $validated;
    }

    private function attributes(array $validated): array
    {
        return ['id_formation' => $validated['formation_id'], 'id_annee_academique' => $validated['annee_academique_id'],
            'annee_parcours' => $validated['annee_parcours'], 'date_inscription' => $validated['date_inscription'],
            'numero_inscription_intec' => $validated['numero_inscription_intec'] ?? null, 'statut' => $validated['statut'],
            'financeur' => $validated['financeur'] ?? 'etudiant'];
    }
}
