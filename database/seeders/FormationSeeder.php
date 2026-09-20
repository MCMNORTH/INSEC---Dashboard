<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Formation;

class FormationSeeder extends Seeder
{
    public function run(): void
    {
        $formations = [
            [
                'code' => 'DGC',
                'nom' => 'DGC',
                'libelle' => 'Diplôme de gestion et de comptabilité',
                'duree_annees' => 3,
                'niveau_diplome' => 'Bac +3',
                'credits_total' => 180,
                'active' => true,
                'source_url' => 'https://intec.cnam.fr/presentation-du-diplome-de-gestion-et-de-comptabilite-dgc--1449587.kjsp',
                'source_verifiee_le' => '2026-09-20',
            ],
            [
                'code' => 'DSGC',
                'nom' => 'DSGC',
                'libelle' => 'Diplôme supérieur de gestion et de comptabilité',
                'duree_annees' => 2,
                'niveau_diplome' => 'Bac +5',
                'credits_total' => 120,
                'active' => true,
                'source_url' => 'https://intec.cnam.fr/diplome-superieur-de-gestion-et-de-comptabilite-dsgc--200729.kjsp',
                'source_verifiee_le' => '2026-09-20',
            ],
        ];

        foreach ($formations as $formation) {
            $modele = Formation::where('code', $formation['code'])
                ->orWhere('nom', $formation['nom'])
                ->first() ?? new Formation();

            $modele->fill($formation)->save();
        }
    }
}
