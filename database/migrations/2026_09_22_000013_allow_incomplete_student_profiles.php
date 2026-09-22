<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('etudiants', function (Blueprint $table) {
            $table->date('date_naissance')->nullable()->after('prenom');
            $table->string('email')->nullable()->change();
        });

        \Illuminate\Support\Facades\DB::table('resultats_examens')->where('presence', 'Absent')->update(['presence' => 'Non présenté']);
    }

    public function down(): void
    {
        Schema::table('etudiants', fn (Blueprint $table) => $table->dropColumn('date_naissance'));
    }
};
