<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('inscriptions', function (Blueprint $table) {
        $table->id();
        $table->foreignId('id_etudiant')->constrained('etudiants', 'id_etudiant')->cascadeOnDelete();
        $table->foreignId('id_formation')->constrained('formations')->cascadeOnDelete();
        $table->foreignId('id_annee_academique')->constrained('annees_academiques')->cascadeOnDelete();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inscriptions');
    }
};
