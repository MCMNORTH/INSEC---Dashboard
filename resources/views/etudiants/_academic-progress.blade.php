<section class="mt-8">
    <h2 class="text-lg font-bold text-[#1E2761] mb-3">Progression académique</h2>
    <div class="grid md:grid-cols-2 gap-4">
        @foreach ($etudiant->inscriptions as $inscription)
            @php
                $totalCredits = $inscription->ues->sum('credits');
                $valides = $inscription->credits_valides;
                $pourcentage = $totalCredits > 0 ? min(100, round($valides * 100 / $totalCredits)) : 0;
            @endphp
            <div class="bg-white rounded-xl shadow p-4">
                <div class="flex justify-between gap-3"><strong>{{ $inscription->formation?->code }} · {{ $inscription->anneeAcademique?->libelle }}</strong><span class="text-sm text-gray-500">{{ $valides }}/{{ $totalCredits }} ECTS</span></div>
                <div class="h-2 rounded bg-gray-200 mt-3"><div class="h-2 rounded bg-green-500" style="width: {{ $pourcentage }}%"></div></div>
                <p class="text-xs text-gray-500 mt-2">{{ $pourcentage }} % des crédits des UE inscrites sont validés.</p>
            </div>
        @endforeach
    </div>
</section>
