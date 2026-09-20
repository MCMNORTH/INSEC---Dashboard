<?php

namespace App\Http\Controllers;

use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use App\Models\Versement;
use Barryvdh\DomPDF\Facade\Pdf;

class PdfController extends Controller
{
    public function attestation(Inscription $inscription)
    {
        $inscription->load(['etudiant', 'formation', 'anneeAcademique', 'ues']);
        return Pdf::loadView('pdf.attestation', compact('inscription'))->download("attestation-inscription-{$inscription->id}.pdf");
    }

    public function releve(Inscription $inscription)
    {
        $inscription->load(['etudiant', 'formation', 'anneeAcademique', 'resultatsExamens.examen.ue']);
        return Pdf::loadView('pdf.releve', compact('inscription'))->download("releve-notes-{$inscription->id}.pdf");
    }

    public function convocation(Examen $examen, ResultatExamen $resultat)
    {
        abort_unless($resultat->examen_id === $examen->id, 404);
        $resultat->load(['inscription.etudiant', 'inscription.formation']);
        $examen->load(['ue', 'anneeAcademique']);
        return Pdf::loadView('pdf.convocation', compact('examen', 'resultat'))->download("convocation-examen-{$resultat->id}.pdf");
    }

    public function recu(Versement $versement)
    {
        $versement->load(['inscription.etudiant', 'inscription.formation', 'inscription.anneeAcademique']);
        return Pdf::loadView('pdf.recu', compact('versement'))->download("recu-{$versement->numero_recu}.pdf");
    }
}
