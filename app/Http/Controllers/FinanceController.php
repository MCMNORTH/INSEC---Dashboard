<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Etudiant;
use App\Models\FactureCnam;
use App\Models\DocumentFinancier;
use App\Models\Inscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\EmailService;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        $etudiants = Etudiant::with(['derniereInscription.versements', 'derniereInscription.echeances', 'derniereInscription.formation', 'derniereInscription.ues'])->orderBy('nom')->get();
        $etudiantSelectionne = $request->integer('etudiant') ? Etudiant::with(['inscriptions' => fn ($q) => $q->with(['formation', 'anneeAcademique'])->latest()])->find($request->integer('etudiant')) : null;
        $inscriptionSelectionnee = null;

        if ($etudiantSelectionne) {
            $inscriptionSelectionnee = $request->integer('inscription')
                ? $etudiantSelectionne->inscriptions()->with(['formation', 'anneeAcademique', 'versements', 'echeances', 'ues'])->find($request->integer('inscription'))
                : $etudiantSelectionne->inscriptions()->with(['formation', 'anneeAcademique', 'versements', 'echeances', 'ues'])->latest()->first();
        }

        $anneeCourante = AnneeAcademique::firstOrCreate(['libelle' => AnneeAcademique::libelleCourante()]);
        $annees = AnneeAcademique::orderBy('libelle', 'desc')->get();
        $anneeSelectionneeId = $request->integer('annee_reversement') ?: $anneeCourante->id;
        $facturesCnam = FactureCnam::whereIn('annee_academique_id', $annees->pluck('id'))->get()->keyBy('annee_academique_id');
        $anneesReversement = $annees->map(function ($annee) use ($facturesCnam) {
            $inscriptions = Inscription::where('id_annee_academique', $annee->id)->with(['versements', 'ues', 'formation'])->get();
            $montantNet = $inscriptions->sum(fn ($i) => $i->montant_net);
            $encaisse = $inscriptions->sum(fn ($i) => $i->total_verse);
            $coutCnamEur = $inscriptions->sum->cout_cnam_total_eur;
            $facture = $facturesCnam->get($annee->id);
            $taux = (float) ($facture?->taux_change_previsionnel ?? 0);
            $coutCnamMru = $coutCnamEur * $taux;
            $bumex = $inscriptions->where('financeur', 'bumex')->sum->montant_net;
            return (object) ['id' => $annee->id, 'libelle' => $annee->libelle, 'nb_etudiants' => $inscriptions->count(),
                'montant_du' => $montantNet, 'reverse' => $encaisse,
                'statut' => $montantNet > 0 && $encaisse >= $montantNet ? 'Soldé' : ($encaisse > 0 ? 'Partiel' : 'Impayé'),
                'nb_ue_dgc' => $inscriptions->where('formation.code', 'DGC')->sum(fn ($i) => $i->ues->count()),
                'nb_ue_dsgc' => $inscriptions->where('formation.code', 'DSGC')->sum(fn ($i) => $i->ues->count()),
                'cout_cnam_eur' => $coutCnamEur, 'cout_cnam_mru' => $coutCnamMru,
                'prise_en_charge_bumex' => $bumex, 'creances' => max($montantNet - $encaisse, 0),
                'marge_previsionnelle' => $taux > 0 ? $montantNet - $coutCnamMru : null,
                'besoin_cnam' => $taux > 0 ? max($coutCnamMru - $encaisse, 0) : null,
                'facture_cnam' => $facture];
        });
        $anneesAvecDonnees = $anneesReversement->filter(fn ($a) => $a->nb_etudiants > 0)->values();
        $carteReversement = $anneesReversement->firstWhere('id', $anneeSelectionneeId);

        return view('finances.index', compact('etudiants', 'etudiantSelectionne', 'inscriptionSelectionnee', 'annees', 'anneesAvecDonnees', 'anneeSelectionneeId', 'carteReversement'));
    }

    public function updateFactureCnam(Request $request, AnneeAcademique $annee)
    {
        $validated = $request->validate([
            'taux_change_previsionnel' => ['nullable', 'numeric', 'min:0.0001'],
            'montant_reel_eur' => ['nullable', 'numeric', 'min:0'],
            'taux_change_reglement' => ['nullable', 'numeric', 'min:0.0001'],
            'date_reception' => ['nullable', 'date'], 'date_echeance' => ['nullable', 'date'],
            'date_reglement' => ['nullable', 'date'],
            'statut' => ['required', 'in:Prévisionnelle,Reçue,À payer,Payée'],
            'reference' => ['nullable', 'string', 'max:100'], 'note' => ['nullable', 'string', 'max:2000'],
        ]);
        FactureCnam::updateOrCreate(['annee_academique_id' => $annee->id], $validated);

        return redirect()->route('finances.index', ['tab' => 'reversement', 'annee_reversement' => $annee->id])
            ->with('status', 'Prévision et facture CNAM mises à jour.');
    }

    public function updateSituation(Request $request, Inscription $inscription)
    {
        $validated = $request->validate(['montant_du' => ['required', 'integer', 'min:0'], 'montant_remise' => ['required', 'integer', 'min:0', 'lte:montant_du'], 'note_financiere' => ['nullable', 'string', 'max:2000'], 'financeur' => ['sometimes', 'in:etudiant,bumex'], 'reference_facture_bumex' => ['nullable', 'string', 'max:100'], 'facture_bumex_emise_le' => ['nullable', 'date']]);
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
            if ($versement->statut === 'Validée') {
                $inscription->load('versements');
                DocumentFinancier::create([
                    'inscription_id' => $inscription->id,
                    'versement_id' => $versement->id,
                    'type' => 'recu',
                    'numero' => $versement->numero_recu,
                    'date_emission' => $versement->date_versement,
                    'montant_total' => $inscription->montant_net,
                    'montant_paye' => $versement->montant,
                    'solde_restant' => $inscription->solde_restant,
                    'details' => ['total_verse_apres_paiement' => $inscription->total_verse],
                ]);
            }
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
