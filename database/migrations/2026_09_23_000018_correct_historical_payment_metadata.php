<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('versements', function (Blueprint $table) {
            $table->date('date_versement')->nullable()->change();
            $table->uuid('submission_id')->nullable()->unique();
        });
        $this->correctMetadata();
    }

    public function correctMetadata(): void
    {
        DB::transaction(function () {
            $payments = DB::table('versements')->where('reference', 'BUMEX-INSEC-2024-2025')
                ->where('numero_recu', 'like', 'REC-BUMEX-202425-%')
                ->where('note', 'Règlement intégral de la prise en charge BUMEX pour 2024-2025.')->get();
            foreach ($payments as $payment) {
                DB::table('versements')->where('id', $payment->id)->update([
                    'date_versement' => null, 'mode_paiement' => 'Non renseigné',
                    'note' => 'Paiement intégral confirmé par la direction. Date et mode historiques non renseignés. Référence interne de reprise.',
                ]);
                DB::table('inscriptions')->where('id', $payment->inscription_id)
                    ->where('facture_bumex_emise_le', '2025-02-01')->update(['facture_bumex_emise_le' => null]);
            }
            if ($payments->isNotEmpty()) {
                DB::table('journal_audit')->insert([
                    'action' => 'historical_metadata_correction', 'modele' => 'Versement',
                    'description' => 'Retrait des dates et modes de paiement historiques non confirmés ; montants conservés.',
                    'avant' => json_encode($payments->map(fn ($p) => ['id' => $p->id, 'date_versement' => $p->date_versement, 'mode_paiement' => $p->mode_paiement])->all()),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Ne pas réintroduire des dates historiques non confirmées.
        Schema::table('versements', function (Blueprint $table) {
            $table->dropUnique(['submission_id']);
            $table->dropColumn('submission_id');
        });
    }
};
