<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\Inscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\EmailService;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        $etudiants = Etudiant::with(['derniereInscription.versements', 'derniereInscription.echeances'])->orderBy('nom')->get();
        $etudiantSelectionne = $request->integer('etudiant') ? Etudiant::with(['inscriptions' => fn ($q) => $q->with(['formation', 'anneeAcademique'])->latest()])->find($request->integer('etudiant')) : null;
        $inscriptionSelectionnee = null;

        if ($etudiantSelectionne) {
            $inscriptionSelectionnee = $request->integer('inscription')
                ? $etudiantSelectionne->inscriptions()->with(['formation', 'anneeAcademique', 'versements', 'echeances'])->find($request->integer('inscription'))
                : $etudiantSelectionne->inscriptions()->with(['formation', 'anneeAcademique', 'versements', 'echeances'])->latest()->first();
        }

        $anneeCourante = AnneeAcademique::firstOrCreate(['libelle' => AnneeAcademique::libelleCourante()]);
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();
        $anneeSelectionneeId = $request->integer('annee_reversement') ?: $anneeCourante->id;
        $anneesReversement = $annees->map(function ($annee) {
            $inscriptions = Inscription::where('id_annee_academique', $annee->id)->with('versements')->get();
            $montantNet = $inscriptions->sum(fn ($i) => $i->montant_net);
            $encaisse = $inscriptions->sum(fn ($i) => $i->total_verse);
            return (object) ['id' => $annee->id, 'libelle' => $annee->libelle, 'nb_etudiants' => $inscriptions->count(),
                'montant_du' => $montantNet, 'reverse' => $encaisse,
                'statut' => $montantNet > 0 && $encaisse >= $montantNet ? 'Soldé' : ($encaisse > 0 ? 'Partiel' : 'Impayé')];
        });
        $anneesAvecDonnees = $anneesReversement->filter(fn ($a) => $a->nb_etudiants > 0)->values();
        $carteReversement = $anneesReversement->firstWhere('id', $anneeSelectionneeId);

        return view('finances.index', compact('etudiants', 'etudiantSelectionne', 'inscriptionSelectionnee', 'annees', 'anneesAvecDonnees', 'anneeSelectionneeId', 'carteReversement'));
    }

    public function updateSituation(Request $request, Inscription $inscription)
    {
        $validated = $request->validate(['montant_du' => ['required', 'integer', 'min:0'], 'montant_remise' => ['required', 'integer', 'min:0', 'lte:montant_du'], 'note_financiere' => ['nullable', 'string', 'max:2000']]);
        $inscription->update($validated);
        return $this->backToInscription($inscription, 'Situation financière mise à jour.');
    }

    public function storeVersement(Request $request, Inscription $inscription)
    {
        $validated = $request->validate([
            'montant' => ['required', 'integer', 'min:1'], 'date_versement' => ['required', 'date'],
            'statut' => ['required', 'in:Validée,En attente,Rejetée'], 'mode_paiement' => ['required', 'in:Espèces,Virement,Chèque,Carte,Mobile Money'],
            'reference' => ['nullable', 'string', 'max:100'], 'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $versement = DB::transaction(function () use ($inscription, $validated) {
            $versement = $inscription->versements()->create($validated);
            $versement->update(['numero_recu' => 'REC-'.now()->format('Ym').'-'.str_pad((string) $versement->id, 6, '0', STR_PAD_LEFT)]);
            return $versement;
        });
        if ($versement->statut === 'Validée') {
            $etudiant=$inscription->etudiant;
            app(EmailService::class)->envoyer($etudiant->email,$etudiant->prenom.' '.$etudiant->nom,'Paiement','Confirmation de votre paiement INSEC','Paiement validé',
                'Votre versement a été validé et enregistré dans votre dossier financier.',['Reçu'=>$versement->numero_recu,'Montant'=>number_format($versement->montant,0,',',' ').' MRU','Date'=>$versement->date_versement->format('d/m/Y')]);
        }
        return $this->backToInscription($inscription, 'Versement enregistré avec un numéro de reçu.');
    }

    public function storeEcheance(Request $request, Inscription $inscription)
    {
        $validated = $request->validate(['libelle' => ['required', 'string', 'max:100'], 'montant' => ['required', 'integer', 'min:1'], 'date_echeance' => ['required', 'date']]);
        $inscription->echeances()->create($validated);
        return $this->backToInscription($inscription, 'Échéance ajoutée.');
    }

    private function backToInscription(Inscription $inscription, string $message)
    {
        return redirect()->route('finances.index', ['etudiant' => $inscription->id_etudiant, 'inscription' => $inscription->id])->with('status', $message);
    }
}
