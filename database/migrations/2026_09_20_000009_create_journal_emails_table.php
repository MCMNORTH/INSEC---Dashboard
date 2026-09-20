<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::create('journal_emails', function(Blueprint $table){ $table->id(); $table->string('destinataire'); $table->string('nom_destinataire')->nullable(); $table->string('type'); $table->string('sujet'); $table->string('statut')->default('En attente'); $table->text('erreur')->nullable(); $table->timestamp('envoye_at')->nullable(); $table->timestamps(); $table->index(['type','statut','created_at']); }); }
    public function down(): void { Schema::dropIfExists('journal_emails'); }
};
