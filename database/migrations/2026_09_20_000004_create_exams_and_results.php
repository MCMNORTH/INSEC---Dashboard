<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('examens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ue_id')->constrained('ues')->restrictOnDelete();
            $table->foreignId('annee_academique_id')->constrained('annees_academiques')->restrictOnDelete();
            $table->string('session')->default('Normale');
            $table->dateTime('date_examen');
            $table->string('salle')->nullable();
            $table->decimal('note_sur', 5, 2)->default(20);
            $table->decimal('seuil_validation', 5, 2)->default(10);
            $table->string('statut')->default('Planifié');
            $table->timestamps();
        });

        Schema::create('resultats_examens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('examen_id')->constrained('examens')->cascadeOnDelete();
            $table->foreignId('inscription_id')->constrained('inscriptions')->cascadeOnDelete();
            $table->string('presence')->default('Convoqué');
            $table->decimal('note', 5, 2)->nullable();
            $table->text('commentaire')->nullable();
            $table->timestamps();
            $table->unique(['examen_id', 'inscription_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resultats_examens');
        Schema::dropIfExists('examens');
    }
};
