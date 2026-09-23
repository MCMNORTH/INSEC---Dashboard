<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            // Explicit request from the account owner on 2026-09-23; no other account changes.
            $owner = DB::table('users')->where('email', 'mohamed.cheikh@bumex.mr')->lockForUpdate()->first();
            if (! $owner || $owner->role !== 'admin') return;
            DB::table('users')->where('id', $owner->id)->update(['role' => 'super_admin', 'updated_at' => now()]);
            DB::table('journal_audit')->insert([
                'user_id' => $owner->id, 'acteur' => $owner->name,
                'action' => 'role_change', 'modele' => 'User', 'modele_id' => (string) $owner->id,
                'description' => 'Passage du compte propriétaire en super-administrateur à sa demande explicite.',
                'avant' => json_encode(['role' => 'admin']), 'apres' => json_encode(['role' => 'super_admin']),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // A code rollback must not silently revoke the owner's explicitly requested access.
    }
};
