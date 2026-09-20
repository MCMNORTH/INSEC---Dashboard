<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alertes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('cle');
            $table->string('type');
            $table->string('niveau')->default('info');
            $table->string('titre');
            $table->text('message');
            $table->string('lien')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamp('lue_at')->nullable();
            $table->timestamp('archivee_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'cle']);
            $table->index(['user_id', 'active', 'lue_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alertes');
    }
};
