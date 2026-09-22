<?php

namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Enseignant;
use App\Models\Etudiant;
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
        $anneeCourante = AnneeAcademique::firstOrCreate(['libelle' => AnneeAcademique::libelleCourante()]);
        $annees = AnneeAcademique::disponibles()->orderByDesc('libelle')->get();
        $anneeId = $request->integer('annee_id') ?: $anneeCourante->id;
        if ($anneeId && ! $annees->contains('id', $anneeId)) abort(422, 'Année académique invalide.');

        $inscriptions = Inscription::with(['etudiant', 'formation', 'versements', 'echeances', 'resultatsExamens.examen.ue'])
            ->when($anneeId, fn ($q) => $q->where('id_annee_academique', $anneeId))->get();
        $inscriptionIds = $inscriptions->pluck('id');

        $montantFacture = $inscriptions->sum->montant_net;
        $encaisses = $inscriptions->sum->total_verse;
        $resteARecouvrer = $inscriptions->sum->solde_restant;
        $montantEnRetard = $inscriptions->sum->montant_en_retard;
        $tauxRecouvrement = $montantFacture > 0 ? round($encaisses / $montantFacture * 100, 1) : 0;

        $resultats = ResultatExamen::with('examen.ue')->whereIn('inscription_id', $inscriptionIds)->whereNotNull('note')->get();
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

        $anneeCivile = now()->year;
        $versementsParMois = Versement::where('statut', 'Validée')->whereIn('inscription_id', $inscriptionIds)
            ->whereYear('date_versement', $anneeCivile)->get()->groupBy(fn ($v) => $v->date_versement->month)->map->sum('montant');
        $moisLabels12 = collect(range(1, 12))->map(fn ($m) => ucfirst(Carbon::create($anneeCivile, $m, 1)->locale('fr')->isoFormat('MMM')));
        $paiements12 = collect(range(1, 12))->map(fn ($m) => (float) ($versementsParMois[$m] ?? 0));
        $repartition = Etudiant::selectRaw('statut_etudiant, count(*) as total')->groupBy('statut_etudiant')->pluck('total', 'statut_etudiant');

        return view('admin.dashboard', compact('annees', 'anneeId', 'montantFacture', 'encaisses', 'resteARecouvrer', 'montantEnRetard',
            'tauxRecouvrement', 'resultats', 'tauxReussite', 'performanceDiplomes', 'performanceUes', 'impayes', 'examensProchains',
            'moisLabels12', 'paiements12', 'repartition') + [
            'totalEtudiants' => Etudiant::count(), 'etudiantsActifs' => Etudiant::where('statut_etudiant', 'Actif')->count(),
            'totalEnseignants' => Enseignant::count(), 'inscriptionsActives' => $inscriptions->where('statut', 'active')->count(),
        ]);
    }
}
