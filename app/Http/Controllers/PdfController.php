<?php

namespace App\Http\Controllers;

use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use App\Models\Versement;
use App\Models\DocumentFinancier;
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
        $versement->load(['inscription.etudiant', 'inscription.formation', 'inscription.anneeAcademique', 'inscription.versements']);
        $document = $versement->documentFinancier()->firstOrCreate([], [
            'inscription_id' => $versement->inscription_id,
            'type' => 'recu',
            'numero' => $versement->numero_recu ?: 'REC-'.now()->format('Ym').'-'.str_pad((string) $versement->id, 6, '0', STR_PAD_LEFT),
            'date_emission' => $versement->date_versement,
            'montant_total' => $versement->inscription->montant_net,
            'montant_paye' => $versement->montant,
            'solde_restant' => $versement->inscription->solde_restant,
            'details' => ['total_verse_apres_paiement' => $versement->inscription->total_verse],
        ]);
        return Pdf::loadView('pdf.recu', compact('versement', 'document'))->setPaper('a4')->download("recu-{$document->numero}.pdf");
    }

    public function facture(Inscription $inscription)
    {
        $inscription->load(['etudiant', 'formation', 'anneeAcademique', 'versements', 'ues']);
        $document = DocumentFinancier::create([
            'inscription_id' => $inscription->id,
            'type' => 'facture',
            'numero' => 'TEMP-'.bin2hex(random_bytes(8)),
            'date_emission' => today(),
            'montant_total' => $inscription->montant_net,
            'montant_paye' => $inscription->total_verse,
            'solde_restant' => $inscription->solde_restant,
            'details' => [
                'financeur' => $inscription->financeur,
                'formation' => $inscription->formation?->code,
                'nombre_ue' => $inscription->ues->count(),
                'prix_ue_mru' => $inscription->prix_vente_ue_mru,
                'ues' => $inscription->ues->map(fn ($ue) => [
                    'code' => $ue->code,
                    'libelle' => $ue->libelle,
                ])->values()->all(),
            ],
        ]);
        $document->update(['numero' => 'FAC-'.now()->format('Ym').'-'.str_pad((string) $document->id, 6, '0', STR_PAD_LEFT)]);

        return Pdf::loadView('pdf.facture', compact('inscription', 'document'))->setPaper('a4')->download("facture-{$document->numero}.pdf");
    }
}
