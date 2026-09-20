<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::create('journal_audit',function(Blueprint $table){$table->id();$table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();$table->string('acteur')->nullable();$table->string('action');$table->string('modele')->nullable();$table->string('modele_id')->nullable();$table->string('description');$table->json('avant')->nullable();$table->json('apres')->nullable();$table->string('adresse_ip',45)->nullable();$table->text('user_agent')->nullable();$table->string('route')->nullable();$table->timestamps();$table->index(['action','modele','created_at']);$table->index(['user_id','created_at']);}); }
    public function down(): void { Schema::dropIfExists('journal_audit'); }
};
