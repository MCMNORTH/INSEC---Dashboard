<?php

namespace App\Http\Controllers;

use App\Models\Etudiant;
use App\Models\PieceAdministrative;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function index(Etudiant $etudiant)
    {
        $etudiant->load(['piecesAdministratives' => fn ($q) => $q->latest(), 'inscriptions.formation', 'inscriptions.anneeAcademique', 'inscriptions.resultatsExamens.examen.ue', 'inscriptions.versements', 'inscriptions.ues']);
        return view('documents.index', compact('etudiant'));
    }

    public function store(Request $request, Etudiant $etudiant)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:Pièce d’identité,Photo,Diplôme,Relevé de notes,Justificatif de paiement,Autre'],
            'fichier' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'date_expiration' => ['nullable', 'date'], 'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $file = $validated['fichier'];
        $path = $file->store("dossiers/{$etudiant->id_etudiant}");
        $etudiant->piecesAdministratives()->create([
            'type' => $validated['type'], 'nom_original' => $file->getClientOriginalName(), 'chemin' => $path,
            'mime_type' => $file->getMimeType(), 'taille' => $file->getSize(), 'date_expiration' => $validated['date_expiration'] ?? null,
            'note' => $validated['note'] ?? null,
        ]);
        return redirect()->route('etudiants.documents.index', $etudiant)->with('status', 'Pièce ajoutée au dossier.');
    }

    public function download(PieceAdministrative $piece)
    {
        abort_unless(Storage::exists($piece->chemin), 404);
        return Storage::download($piece->chemin, $piece->nom_original);
    }

    public function update(Request $request, PieceAdministrative $piece)
    {
        $validated = $request->validate(['statut' => ['required', 'in:À vérifier,Validé,Rejeté'], 'note' => ['nullable', 'string', 'max:1000']]);
        $piece->update($validated);
        return redirect()->route('etudiants.documents.index', $piece->etudiant_id)->with('status', 'Statut de la pièce mis à jour.');
    }
}
