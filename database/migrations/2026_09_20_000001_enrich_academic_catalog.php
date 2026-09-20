<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('formations', function (Blueprint $table) {
            $table->string('code', 10)->nullable()->unique()->after('id');
            $table->unsignedTinyInteger('duree_annees')->default(1)->after('libelle');
            $table->string('niveau_diplome')->nullable()->after('duree_annees');
            $table->unsignedSmallInteger('credits_total')->default(0)->after('niveau_diplome');
            $table->boolean('active')->default(true)->after('credits_total');
            $table->string('source_url')->nullable()->after('active');
            $table->date('source_verifiee_le')->nullable()->after('source_url');
        });

        Schema::table('ues', function (Blueprint $table) {
            $table->foreignId('formation_id')->nullable()->after('id')
                ->constrained('formations')->nullOnDelete();
            $table->unsignedTinyInteger('annee_parcours')->nullable()->after('credits');
            $table->unsignedTinyInteger('ordre')->default(0)->after('annee_parcours');
            $table->boolean('active')->default(true)->after('ordre');
            $table->index(['formation_id', 'annee_parcours']);
        });
    }

    public function down(): void
    {
        Schema::table('ues', function (Blueprint $table) {
            $table->dropForeign(['formation_id']);
            $table->dropIndex(['formation_id', 'annee_parcours']);
            $table->dropColumn(['formation_id', 'annee_parcours', 'ordre', 'active']);
        });

        Schema::table('formations', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->dropColumn([
                'code', 'duree_annees', 'niveau_diplome', 'credits_total',
                'active', 'source_url', 'source_verifiee_le',
            ]);
        });
    }
};
