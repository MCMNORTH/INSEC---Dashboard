<?php

namespace App\Http\Controllers;

use App\Models\Examen;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    public function redirect(Request $request)
    {
        return match ($request->user()->role) {
            'admin', 'super_admin' => redirect()->route('admin.dashboard'),
            'finance' => redirect()->route('finances.index'),
            'enseignant' => redirect()->route('portail.enseignant'),
            'etudiant' => redirect()->route('portail.etudiant'),
            default => abort(403),
        };
    }

    public function etudiant(Request $request)
    {
        $etudiant = $request->user()->etudiant;
        abort_unless($etudiant, 403, 'Aucun dossier étudiant n’est rattaché à ce compte.');
        $etudiant->load(['inscriptions' => fn ($q) => $q->with(['formation', 'anneeAcademique', 'ues', 'versements', 'echeances', 'resultatsExamens.examen.ue'])->latest()]);
        $examensAVenir = $etudiant->inscriptions->flatMap->resultatsExamens->filter(fn ($r) => $r->examen?->date_examen?->isFuture())->sortBy(fn ($r) => $r->examen->date_examen);
        return view('portails.etudiant', compact('etudiant', 'examensAVenir'));
    }

    public function enseignant(Request $request)
    {
        $enseignant = $request->user()->enseignant;
        abort_unless($enseignant, 403, 'Aucun dossier enseignant n’est rattaché à ce compte.');
        $enseignant->load('affectations.ue.formation');
        $ueIds = $enseignant->affectations->pluck('ue_id');
        $examens = Examen::with(['ue', 'anneeAcademique'])->withCount('resultats')->whereIn('ue_id', $ueIds)->orderByDesc('date_examen')->get();
        return view('portails.enseignant', compact('enseignant', 'examens'));
    }
}
