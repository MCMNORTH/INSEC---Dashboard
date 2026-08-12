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
    Schema::create('affectation_enseignant', function (Blueprint $table) {
        $table->id();
        $table->foreignId('enseignant_id')->constrained('enseignants')->cascadeOnDelete();
        $table->foreignId('ue_id')->constrained('ues')->cascadeOnDelete();
        $table->unsignedInteger('nombre_etudiants')->default(0);
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('affectation_enseignants');
    }
};
