<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inscriptions', function (Blueprint $table) {
            $table->string('financeur')->default('etudiant')->after('statut');
            $table->unsignedInteger('prix_vente_ue_mru')->default(0)->after('financeur');
            $table->decimal('cout_cnam_ue_eur', 10, 2)->default(0)->after('prix_vente_ue_mru');
            $table->string('reference_facture_bumex')->nullable()->after('cout_cnam_ue_eur');
            $table->date('facture_bumex_emise_le')->nullable()->after('reference_facture_bumex');
        });

        Schema::create('factures_cnam', function (Blueprint $table) {
            $table->id();
            $table->foreignId('annee_academique_id')->unique()->constrained('annees_academiques')->restrictOnDelete();
            $table->decimal('taux_change_previsionnel', 10, 4)->nullable();
            $table->decimal('montant_reel_eur', 12, 2)->nullable();
            $table->decimal('taux_change_reglement', 10, 4)->nullable();
            $table->date('date_reception')->nullable();
            $table->date('date_echeance')->nullable();
            $table->date('date_reglement')->nullable();
            $table->string('statut')->default('Prévisionnelle');
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        DB::table('inscriptions')->join('formations', 'formations.id', '=', 'inscriptions.id_formation')
            ->select('inscriptions.id', 'formations.code')->orderBy('inscriptions.id')->each(function ($inscription) {
                $tarif = config('insec.tarifs_ue.'.$inscription->code);
                if (! $tarif) return;
                $nombreUe = DB::table('inscription_ue')->where('inscription_id', $inscription->id)->count();
                DB::table('inscriptions')->where('id', $inscription->id)->update([
                    'prix_vente_ue_mru' => $tarif['vente_mru'],
                    'cout_cnam_ue_eur' => $tarif['cout_cnam_eur'],
                    'montant_du' => $nombreUe * $tarif['vente_mru'],
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('factures_cnam');
        Schema::table('inscriptions', fn (Blueprint $table) => $table->dropColumn([
            'financeur', 'prix_vente_ue_mru', 'cout_cnam_ue_eur',
            'reference_facture_bumex', 'facture_bumex_emise_le',
        ]));
    }
};
