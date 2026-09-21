<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents_financiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inscription_id')->constrained('inscriptions')->cascadeOnDelete();
            $table->foreignId('versement_id')->nullable()->unique()->constrained('versements')->nullOnDelete();
            $table->string('type', 20);
            $table->string('numero', 50)->unique();
            $table->date('date_emission');
            $table->unsignedBigInteger('montant_total')->default(0);
            $table->unsignedBigInteger('montant_paye')->default(0);
            $table->unsignedBigInteger('solde_restant')->default(0);
            $table->json('details')->nullable();
            $table->timestamps();
            $table->index(['inscription_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents_financiers');
    }
};
