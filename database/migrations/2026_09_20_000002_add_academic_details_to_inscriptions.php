<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inscriptions', function (Blueprint $table) {
            $table->unsignedTinyInteger('annee_parcours')->nullable()->after('id_annee_academique');
            $table->date('date_inscription')->nullable()->after('annee_parcours');
            $table->string('numero_inscription_intec')->nullable()->after('date_inscription');
            $table->string('statut')->default('active')->after('numero_inscription_intec');
            $table->index(['id_etudiant', 'statut']);
        });

        Schema::create('inscription_ue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inscription_id')->constrained('inscriptions')->cascadeOnDelete();
            $table->foreignId('ue_id')->constrained('ues')->restrictOnDelete();
            $table->string('statut')->default('inscrite');
            $table->timestamps();
            $table->unique(['inscription_id', 'ue_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inscription_ue');

        Schema::table('inscriptions', function (Blueprint $table) {
            $table->dropIndex(['id_etudiant', 'statut']);
            $table->dropColumn([
                'annee_parcours', 'date_inscription', 'numero_inscription_intec', 'statut',
            ]);
        });
    }
};
