<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\Ue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EtudiantController extends Controller
{
    public function index(Request $request)
    {
        $query = Etudiant::with(['derniereInscription.formation', 'derniereInscription.anneeAcademique']);
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(fn ($q) => $q->where('nom', 'like', "%{$search}%")->orWhere('prenom', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }
        if ($request->filled('formation_id')) {
            $query->whereHas('inscriptions', fn ($q) => $q->where('id_formation', $request->input('formation_id')));
        }
        if ($request->filled('annee_id')) {
            $query->whereHas('inscriptions', fn ($q) => $q->where('id_annee_academique', $request->input('annee_id')));
        }
        $etudiants = $query->orderBy('nom')->paginate(10)->withQueryString();
        $formations = Formation::where('active', true)->orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();
        return view('etudiants.index', compact('etudiants', 'formations', 'annees'));
    }

    public function create()
    {
        $formations = Formation::with('ues')->where('active', true)->orderBy('nom')->get();
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();
        return view('etudiants.create', compact('formations', 'annees'));
    }

    public function store(Request $request)
    {
        $validated = $this->validateStudentAndEnrollment($request);
        $etudiant = DB::transaction(function () use ($validated) {
            $etudiant = Etudiant::create([
                'nom' => $validated['nom'], 'prenom' => $validated['prenom'], 'date_naissance' => $validated['date_naissance'] ?? null, 'email' => $validated['email'] ?? null,
                'telephone' => $validated['telephone'] ?? null, 'statut_etudiant' => $validated['statut_etudiant'],
            ]);
            $inscription = $etudiant->inscriptions()->create($this->enrollmentAttributes($validated));
            $inscription->ues()->sync($validated['ue_ids']);
            $inscription->synchroniserTarification();
            return $etudiant;
        });
        return redirect()->route('etudiants.show', $etudiant)->with('status', 'Étudiant et première inscription enregistrés.');
    }

    public function show(Etudiant $etudiant)
    {
        $etudiant->load(['inscriptions' => fn ($q) => $q->with(['formation', 'anneeAcademique', 'ues', 'versements', 'resultatsExamens.examen.ue'])->latest()]);
        return view('etudiants.show', compact('etudiant'));
    }

    public function edit(Etudiant $etudiant) { return view('etudiants.edit', compact('etudiant')); }

    public function update(Request $request, Etudiant $etudiant)
    {
        $validated = $request->validate([
            'nom' => ['required', 'string', 'max:255'], 'prenom' => ['required', 'string', 'max:255'],
            'date_naissance' => ['nullable', 'date'],
            'email' => ['nullable', 'email', Rule::unique('etudiants', 'email')->ignore($etudiant->id_etudiant, 'id_etudiant')],
            'telephone' => ['nullable', 'string', 'max:30'],
            'statut_etudiant' => ['required', Rule::in(['Actif', 'Suspendu', 'Diplômé', 'Abandon'])],
        ]);
        $etudiant->update($validated);
        return redirect()->route('etudiants.show', $etudiant)->with('status', 'Identité mise à jour sans modifier l’historique.');
    }

    public function destroy(Etudiant $etudiant)
    {
        if ($etudiant->inscriptions()->whereHas('versements')->exists()) {
            return redirect()->route('etudiants.index')->with('error', 'Impossible de supprimer cet étudiant : un historique financier existe.');
        }
        $etudiant->delete();
        return redirect()->route('etudiants.index')->with('status', 'Étudiant supprimé.');
    }

    private function validateStudentAndEnrollment(Request $request): array
    {
        $validated = $request->validate([
            'nom' => ['required', 'string', 'max:255'], 'prenom' => ['required', 'string', 'max:255'],
            'date_naissance' => ['nullable', 'date'], 'email' => ['nullable', 'email', 'unique:etudiants,email'], 'telephone' => ['nullable', 'string', 'max:30'],
            'statut_etudiant' => ['required', Rule::in(['Actif', 'Suspendu', 'Diplômé', 'Abandon'])],
            'formation_id' => ['required', 'exists:formations,id'], 'annee_academique_id' => ['required', 'exists:annees_academiques,id'],
            'annee_parcours' => ['required', 'integer', 'min:1'], 'date_inscription' => ['required', 'date'],
            'numero_inscription_intec' => ['nullable', 'string', 'max:100'], 'ue_ids' => ['required', 'array', 'min:1'],
            'financeur' => ['nullable', Rule::in(['etudiant', 'bumex'])],
            'ue_ids.*' => ['integer', 'distinct', 'exists:ues,id'],
        ]);
        $formation = Formation::findOrFail($validated['formation_id']);
        $count = Ue::where('formation_id', $formation->id)->where('annee_parcours', $validated['annee_parcours'])->whereIn('id', $validated['ue_ids'])->count();
        if ($validated['annee_parcours'] > $formation->duree_annees || $count !== count($validated['ue_ids'])) {
            throw ValidationException::withMessages(['ue_ids' => 'Les UE choisies doivent appartenir au diplôme et à l’année de parcours sélectionnés.']);
        }
        return $validated;
    }

    private function enrollmentAttributes(array $validated): array
    {
        return ['id_formation' => $validated['formation_id'], 'id_annee_academique' => $validated['annee_academique_id'],
            'annee_parcours' => $validated['annee_parcours'], 'date_inscription' => $validated['date_inscription'],
            'numero_inscription_intec' => $validated['numero_inscription_intec'] ?? null, 'statut' => 'active',
            'financeur' => $validated['financeur'] ?? 'etudiant'];
    }
}
