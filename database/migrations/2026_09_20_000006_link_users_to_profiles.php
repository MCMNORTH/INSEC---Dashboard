<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('etudiant_id')->nullable()->unique()->after('role')->constrained('etudiants', 'id_etudiant')->nullOnDelete();
            $table->foreignId('enseignant_id')->nullable()->unique()->after('etudiant_id')->constrained('enseignants')->nullOnDelete();
            $table->boolean('active')->default(true)->after('enseignant_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['etudiant_id']);
            $table->dropForeign(['enseignant_id']);
            $table->dropColumn(['etudiant_id', 'enseignant_id', 'active']);
        });
    }
};
