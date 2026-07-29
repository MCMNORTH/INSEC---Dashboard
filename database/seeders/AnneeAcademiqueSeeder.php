<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\AnneeAcademique;

class AnneeAcademiqueSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['2022-2023', '2023-2024', '2024-2025', '2025-2026', '2026-2027', '2027-2028'] as $libelle) {
            AnneeAcademique::firstOrCreate(['libelle' => $libelle]);
        }
    }
}