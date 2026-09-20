<?php

namespace App\Http\Controllers;

use App\Models\Etudiant;
use App\Models\Enseignant;
use App\Models\Versement;
use Carbon\Carbon;

class AdminDashboardController extends Controller
{
    public function index()
    {
        if (auth()->user()->role !== 'admin') {
            abort(403, "Vous n'êtes pas autorisé à accéder à cette page.");
        }

        $totalEtudiants = Etudiant::count();
        $etudiantsActifs = Etudiant::where('statut_etudiant', 'Actif')->count();
        $totalEnseignants = Enseignant::count();

        $encaisses = Versement::where('statut', 'Validée')->sum('montant');
        $enAttente = Versement::where('statut', 'En attente')->sum('montant');

        // Paiements validés, Janvier à Décembre de l'année en cours
        $anneeActuelle = Carbon::now()->year;
        $moisLabels12 = collect();
        $paiements12 = collect();
        for ($m = 1; $m <= 12; $m++) {
            $date = Carbon::create($anneeActuelle, $m, 1);
            $moisLabels12->push(ucfirst($date->locale('fr')->isoFormat('MMM')));
            $total = Versement::where('statut', 'Validée')
                ->whereYear('date_versement', $anneeActuelle)
                ->whereMonth('date_versement', $m)
                ->sum('montant');
            $paiements12->push((float) $total);
        }

        // Répartition des étudiants par statut
        $repartition = Etudiant::selectRaw('statut_etudiant, count(*) as total')
            ->groupBy('statut_etudiant')
            ->pluck('total', 'statut_etudiant');

        return view('admin.dashboard', [
            'totalEtudiants'      => $totalEtudiants,
            'etudiantsActifs'     => $etudiantsActifs,
            'totalEnseignants'    => $totalEnseignants,
            'encaissesFormatted'  => $this->formatMontant($encaisses),
            'enAttenteFormatted'  => $this->formatMontant($enAttente),
            'moisLabels12'        => $moisLabels12,
            'paiements12'         => $paiements12,
            'statutActif'         => $repartition['Actif'] ?? 0,
            'statutSuspendu'      => $repartition['Suspendu'] ?? 0,
            'statutAbandon'       => $repartition['Abandon'] ?? 0,
        ]);
    }

    private function formatMontant($valeur)
    {
        if ($valeur >= 1000000) {
            return number_format($valeur / 1000000, 1, ',', ' ') . 'M';
        }
        if ($valeur >= 1000) {
            return number_format($valeur / 1000, 1, ',', ' ') . 'K';
        }
        return number_format($valeur, 0, ',', ' ');
    }
}