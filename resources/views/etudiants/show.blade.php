<x-app-layout>
    <div class="p-6">
        <a href="{{ route('etudiants.index') }}" class="text-sm text-gray-500">&larr; Retour à la liste</a>
        <h1 class="text-xl font-bold text-[#1E2761] mt-2">{{ $etudiant->nom }} {{ $etudiant->prenom }}</h1>
        <span class="inline-block mt-1 px-3 py-1 text-xs rounded-full bg-green-100 text-green-700">
            {{ $etudiant->statut_etudiant }}
        </span>
        <div class="grid grid-cols-2 gap-4 mt-6">
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
</x-app-layout>