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
use Illuminate\Validation\ValidationException;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        if (! $request->filled('annee_id') && $request->filled('annee_reversement')) {
            $request->merge(['annee_id' => $request->integer('annee_reversement')]);
        }
        [$annees, $anneeSelectionneeId] = AnneeAcademique::contexte($request);

        $relationsFinancieres = ['formation', 'anneeAcademique', 'versements', 'echeances', 'ues'];
        $etudiants = Etudiant::whereHas('inscriptions', fn ($q) => $q->where('id_annee_academique', $anneeSelectionneeId))
            ->with(['inscriptions' => fn ($q) => $q->where('id_annee_academique', $anneeSelectionneeId)->with($relationsFinancieres)->latest()])
            ->orderBy('nom')->get();
        $etudiantSelectionne = $request->integer('etudiant') ? Etudiant::whereHas('inscriptions', fn ($q) => $q->where('id_annee_academique', $anneeSelectionneeId))
            ->with(['inscriptions' => fn ($q) => $q->where('id_annee_academique', $anneeSelectionneeId)->with($relationsFinancieres)->latest()])
            ->find($request->integer('etudiant')) : null;
        $inscriptionSelectionnee = null;

        if ($etudiantSelectionne) {
            $inscriptionSelectionnee = $request->integer('inscription')
                ? $etudiantSelectionne->inscriptions()->where('id_annee_academique', $anneeSelectionneeId)->with($relationsFinancieres)->find($request->integer('inscription'))
                : $etudiantSelectionne->inscriptions->first();
        }

        $facturesCnam = FactureCnam::whereIn('annee_academique_id', $annees->pluck('id'))->get()->keyBy('annee_academique_id');
        $inscriptionsParAnnee = Inscription::whereIn('id_annee_academique', $annees->pluck('id'))
            ->with(['versements', 'ues', 'formation'])->get()->groupBy('id_annee_academique');
        $anneesReversement = $annees->map(function ($annee) use ($facturesCnam, $inscriptionsParAnnee) {
            $inscriptions = $inscriptionsParAnnee->get($annee->id, collect());
            $montantNet = $inscriptions->sum(fn ($i) => $i->montant_net);
            $encaisse = $inscriptions->sum(fn ($i) => $i->total_verse);
            $coutCnamEur = $inscriptions->sum->cout_cnam_total_eur;
            $facture = $facturesCnam->get($annee->id);
            $taux = (float) ($facture?->taux_change_previsionnel ?? 0);
            $coutCnamMru = $coutCnamEur * $taux;
            $coutRetenuEur = $facture?->montant_reel_eur !== null ? (float) $facture->montant_reel_eur : $coutCnamEur;
            $tauxRetenu = (float) ($facture?->taux_change_reglement ?? $taux);
            $resteCnamEur = $facture?->statut === 'Payée' ? 0 : $coutRetenuEur;
            $bumex = $inscriptions->where('financeur', 'bumex')->sum->montant_net;
            return (object) ['id' => $annee->id, 'libelle' => $annee->libelle, 'nb_etudiants' => $inscriptions->pluck('id_etudiant')->unique()->count(),
                'montant_du' => $montantNet, 'reverse' => $encaisse,
                'statut' => $inscriptions->isEmpty() ? 'Aucun dossier' : ($inscriptions->sum->solde_restant == 0 ? 'Soldé' : ($encaisse > 0 ? 'Partiel' : 'Impayé')),
                'nb_ue_dgc' => $inscriptions->where('formation.code', 'DGC')->sum(fn ($i) => $i->ues->count()),
                'nb_ue_dsgc' => $inscriptions->where('formation.code', 'DSGC')->sum(fn ($i) => $i->ues->count()),
                'cout_cnam_eur' => $coutCnamEur, 'cout_cnam_mru' => $coutCnamMru,
                'prise_en_charge_bumex' => $bumex, 'creances' => $inscriptions->sum->solde_restant,
                'marge_previsionnelle' => $taux > 0 ? $montantNet - $coutCnamMru : null,
                'reste_cnam_eur' => $resteCnamEur,
                'cout_reel_mru' => $facture?->statut === 'Payée' ? $coutRetenuEur * $tauxRetenu : null,
                'besoin_cnam' => $resteCnamEur == 0 ? 0 : ($tauxRetenu > 0 ? max($resteCnamEur * $tauxRetenu - $encaisse, 0) : null),
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
            'montant_reel_eur' => ['required_if:statut,Payée', 'nullable', 'numeric', 'min:0'],
            'taux_change_reglement' => ['required_if:statut,Payée', 'nullable', 'numeric', 'min:0.0001'],
            'date_reception' => ['nullable', 'date'], 'date_echeance' => ['nullable', 'date'],
            'date_reglement' => ['required_if:statut,Payée', 'nullable', 'date'],
            'statut' => ['required', 'in:Prévisionnelle,Reçue,À payer,Payée'],
            'reference' => ['nullable', 'string', 'max:100'], 'note' => ['nullable', 'string', 'max:2000'],
        ]);
        FactureCnam::updateOrCreate(['annee_academique_id' => $annee->id], $validated);

        return redirect()->route('finances.index', ['tab' => 'reversement', 'annee_id' => $annee->id])
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
            'submission_id' => ['required', 'uuid'],
            'montant' => ['required', 'integer', 'min:1'], 'date_versement' => ['required', 'date_format:Y-m-d'],
            'statut' => ['required', 'in:Validée,En attente,Rejetée'], 'mode_paiement' => ['required', 'in:Espèces,Virement,Chèque,Carte,Mobile Money'],
            'reference' => ['nullable', 'string', 'max:100'], 'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $versement = DB::transaction(function () use ($inscription, $validated) {
            $inscription = Inscription::whereKey($inscription->id)->lockForUpdate()->firstOrFail();
            $existing = \App\Models\Versement::where('submission_id', $validated['submission_id'])->first();
            if ($existing) {
                if ((int) $existing->inscription_id !== (int) $inscription->id || (int) $existing->montant !== (int) $validated['montant'] || $existing->statut !== $validated['statut']
                    || $existing->mode_paiement !== $validated['mode_paiement'] || $existing->date_versement->format('Y-m-d') !== $validated['date_versement']
                    || ($existing->reference ?? '') !== ($validated['reference'] ?? '') || ($existing->note ?? '') !== ($validated['note'] ?? '')) {
                    throw ValidationException::withMessages(['montant' => 'Cette opération a déjà été enregistrée avec des informations différentes. Rechargez le dossier.']);
                }
                return $existing;
            }
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
        if ($versement->wasRecentlyCreated && $versement->statut === 'Validée') {
            $etudiant=$inscription->etudiant;
            if ($etudiant->email) app(EmailService::class)->envoyer($etudiant->email,$etudiant->prenom.' '.$etudiant->nom,'Paiement','Confirmation de votre paiement INSEC','Paiement validé',
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
        return redirect()->route('finances.index', [
            'etudiant' => $inscription->id_etudiant,
            'inscription' => $inscription->id,
            'annee_id' => $inscription->id_annee_academique,
        ])->with('status', $message);
    }
}
