<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pieces_administratives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etudiant_id')->constrained('etudiants', 'id_etudiant')->cascadeOnDelete();
            $table->string('type');
            $table->string('nom_original');
            $table->string('chemin');
            $table->string('mime_type');
            $table->unsignedBigInteger('taille');
            $table->string('statut')->default('À vérifier');
            $table->date('date_expiration')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void { Schema::dropIfExists('pieces_administratives'); }
};
