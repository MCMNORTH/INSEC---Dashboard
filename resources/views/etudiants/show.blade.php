<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <a href="{{ route('etudiants.index') }}" class="text-sm text-gray-500">&larr; Retour à la liste</a>
            

            @php $inscription = $etudiant->inscriptions->last(); @endphp

            <div class="bg-white rounded-xl shadow p-6 mt-4 max-w-3xl">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full bg-[#1E2761] text-white flex items-center justify-center font-bold">
                        {{ strtoupper(substr($etudiant->prenom, 0, 1) . substr($etudiant->nom, 0, 1)) }}
                    </div>
                    <div>
                        <h1 class="text-lg font-bold text-[#1E2761]">{{ $etudiant->nom }} {{ $etudiant->prenom }}</h1>
                        <x-statut-badge :statut="$etudiant->statut_etudiant" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">Formation</p>
                        <p class="font-medium">{{ $inscription?->formation?->nom ?? '—' }}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">Année académique</p>
                        <p class="font-medium">{{ $inscription?->anneeAcademique?->libelle ?? '—' }}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">E-mail</p>
                        <p class="font-medium">{{ $etudiant->email }}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">Téléphone</p>
                        <p class="font-medium">{{ $etudiant->telephone ?? '—' }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>