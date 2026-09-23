<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Enseignant;
use App\Models\Examen;
use App\Models\Inscription;
use App\Models\ResultatExamen;
use App\Models\Versement;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    public function index(Request $request)
    {
        [$annees, $anneeId] = AnneeAcademique::contexte($request);

        $inscriptions = Inscription::with(['etudiant', 'formation', 'versements', 'echeances', 'resultatsExamens.examen.ue'])
            ->when($anneeId, fn ($q) => $q->where('id_annee_academique', $anneeId))->get();
        $inscriptionIds = $inscriptions->pluck('id');

        $montantFacture = $inscriptions->sum->montant_net;
        $encaisses = $inscriptions->sum->total_verse;
        $resteARecouvrer = $inscriptions->sum->solde_restant;
        $montantEnRetard = $inscriptions->sum->montant_en_retard;
        $tauxRecouvrement = $montantFacture > 0 ? round($encaisses / $montantFacture * 100, 1) : 0;

        $resultats = $inscriptions->flatMap->resultatsExamens->whereNotNull('note');
        $tauxReussite = $resultats->count() ? round($resultats->filter->valide->count() / $resultats->count() * 100, 1) : 0;

        $performanceDiplomes = $inscriptions->groupBy(fn ($i) => $i->formation?->code ?? '—')->map(function ($groupe, $code) {
            $notes = $groupe->flatMap->resultatsExamens->whereNotNull('note');
            return ['code' => $code, 'inscrits' => $groupe->pluck('id_etudiant')->unique()->count(), 'notes' => $notes->count(),
                'valides' => $notes->filter->valide->count(), 'taux' => $notes->count() ? round($notes->filter->valide->count() / $notes->count() * 100, 1) : 0];
        })->values();

        $performanceUes = $resultats->groupBy('examen.ue_id')->map(function ($notes) {
            $ue = $notes->first()->examen->ue;
            return ['code' => $ue->code, 'libelle' => $ue->libelle, 'notes' => $notes->count(),
                'moyenne' => round($notes->avg('note'), 2), 'taux' => round($notes->filter->valide->count() / $notes->count() * 100, 1)];
        })->sortByDesc('taux')->values()->take(8);

        $impayes = $inscriptions->filter(fn ($i) => $i->solde_restant > 0)->sortByDesc('montant_en_retard')->take(8);
        $examensProchains = Examen::with('ue')->when($anneeId, fn ($q) => $q->where('annee_academique_id', $anneeId))
            ->where('statut', 'Planifié')->whereBetween('date_examen', [now(), now()->addDays(30)])->orderBy('date_examen')->take(6)->get();

        $libelleAnnee = $annees->firstWhere('id', $anneeId)->libelle;
        $debutPeriode = Carbon::create((int) substr($libelleAnnee, 0, 4), 9, 1)->startOfDay();
        $finPeriode = $debutPeriode->copy()->addYear();
        $versementsParMois = $inscriptions->flatMap->versements
            ->filter(fn ($v) => $v->statut === 'Validée' && $v->date_versement
                && $v->date_versement->gte($debutPeriode) && $v->date_versement->lt($finPeriode))
            ->groupBy(fn ($v) => $v->date_versement->format('Y-m'))->map->sum('montant');
        $mois = collect(range(0, 11))->map(fn ($m) => $debutPeriode->copy()->addMonths($m));
        $moisLabels12 = $mois->map(fn ($m) => ucfirst($m->locale('fr')->isoFormat('MMM YY')));
        $paiements12 = $mois->map(fn ($m) => (float) ($versementsParMois[$m->format('Y-m')] ?? 0));
        $horsGraphique = $encaisses - $paiements12->sum();
        $etudiantsSelectionnes = $inscriptions->pluck('etudiant')->filter()->unique('id_etudiant');
        $repartition = $etudiantsSelectionnes->groupBy('statut_etudiant')->map->count();

        return view('admin.dashboard', compact('annees', 'anneeId', 'montantFacture', 'encaisses', 'resteARecouvrer', 'montantEnRetard',
            'tauxRecouvrement', 'resultats', 'tauxReussite', 'performanceDiplomes', 'performanceUes', 'impayes', 'examensProchains',
            'moisLabels12', 'paiements12', 'repartition', 'libelleAnnee', 'horsGraphique') + [
            'totalEtudiants' => $etudiantsSelectionnes->count(),
            'etudiantsActifs' => $etudiantsSelectionnes->where('statut_etudiant', 'Actif')->count(),
            'totalEnseignants' => Enseignant::count(), 'inscriptionsActives' => $inscriptions->where('statut', 'active')->count(),
        ]);
    }
}
