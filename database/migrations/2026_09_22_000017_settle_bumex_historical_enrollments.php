<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (app()->environment('testing')) {
            return;
        }

        $anneeId = DB::table('annees_academiques')->where('libelle', '2024-2025')->value('id');
        $inscriptions = DB::table('inscriptions')
            ->where('id_annee_academique', $anneeId)
            ->where('financeur', 'bumex')
            ->get();

        if ($inscriptions->count() !== 11) {
            throw new \RuntimeException("Règlement BUMEX impossible : {$inscriptions->count()}/11 dossiers trouvés.");
        }

        $maintenant = now();
        foreach ($inscriptions as $inscription) {
            $montant = max((int) $inscription->montant_du - (int) $inscription->montant_remise, 0);
            $numeroIntec = $inscription->numero_inscription_intec ?: $inscription->id;
            $numeroRecu = 'REC-BUMEX-202425-'.$numeroIntec;

            DB::table('inscriptions')->where('id', $inscription->id)->update([
                'reference_facture_bumex' => 'FAC-BUMEX-INSEC-2024-2025',
                'facture_bumex_emise_le' => '2025-02-01',
                'note_financiere' => 'Prise en charge intégrale réglée par BUMEX.',
                'updated_at' => $maintenant,
            ]);

            DB::table('versements')->updateOrInsert(
                ['inscription_id' => $inscription->id, 'reference' => 'BUMEX-INSEC-2024-2025'],
                [
                    'montant' => $montant,
                    'mode_paiement' => 'Virement',
                    'numero_recu' => $numeroRecu,
                    'date_versement' => '2025-02-28',
                    'statut' => 'Validée',
                    'note' => 'Règlement intégral de la prise en charge BUMEX pour 2024-2025.',
                    'created_at' => $maintenant,
                    'updated_at' => $maintenant,
                ]
            );
        }

        $soldes = DB::table('versements')
            ->whereIn('inscription_id', $inscriptions->pluck('id'))
            ->where('statut', 'Validée')
            ->groupBy('inscription_id')
            ->selectRaw('inscription_id, SUM(montant) as total')
            ->get()
            ->keyBy('inscription_id');

        $nombreSoldes = $inscriptions->filter(fn ($inscription) =>
            (int) ($soldes[$inscription->id]->total ?? 0) >= max((int) $inscription->montant_du - (int) $inscription->montant_remise, 0)
        )->count();

        if ($nombreSoldes !== 11) {
            throw new \RuntimeException("Règlement BUMEX incomplet : {$nombreSoldes}/11 dossiers soldés.");
        }
    }

    public function down(): void
    {
        // Les règlements confirmés sont des données financières métier.
    }
};
