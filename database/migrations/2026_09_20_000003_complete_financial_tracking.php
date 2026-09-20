<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inscriptions', function (Blueprint $table) {
            $table->unsignedInteger('montant_remise')->default(0)->after('montant_du');
            $table->text('note_financiere')->nullable()->after('montant_remise');
        });

        Schema::table('versements', function (Blueprint $table) {
            $table->string('mode_paiement')->default('Espèces')->after('montant');
            $table->string('reference')->nullable()->after('mode_paiement');
            $table->string('numero_recu')->nullable()->unique()->after('reference');
            $table->text('note')->nullable()->after('statut');
        });

        Schema::create('echeances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inscription_id')->constrained('inscriptions')->cascadeOnDelete();
            $table->string('libelle');
            $table->unsignedInteger('montant');
            $table->date('date_echeance');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('echeances');
        Schema::table('versements', function (Blueprint $table) {
            $table->dropUnique(['numero_recu']);
            $table->dropColumn(['mode_paiement', 'reference', 'numero_recu', 'note']);
        });
        Schema::table('inscriptions', fn (Blueprint $table) => $table->dropColumn(['montant_remise', 'note_financiere']));
    }
};
