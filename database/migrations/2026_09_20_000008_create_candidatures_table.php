<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('candidatures', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->string('nom'); $table->string('prenom');
            $table->string('email'); $table->string('telephone');
            $table->date('date_naissance')->nullable();
            $table->string('dernier_diplome');
            $table->foreignId('formation_id')->constrained('formations')->restrictOnDelete();
            $table->foreignId('annee_academique_id')->constrained('annees_academiques')->restrictOnDelete();
            $table->text('motivation')->nullable();
            $table->string('statut')->default('Nouvelle');
            $table->text('note_interne')->nullable();
            $table->foreignId('etudiant_id')->nullable()->constrained('etudiants', 'id_etudiant')->nullOnDelete();
            $table->timestamp('traitee_at')->nullable();
            $table->timestamps();
            $table->unique(['email', 'annee_academique_id']);
            $table->index(['statut', 'created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('candidatures'); }
};
