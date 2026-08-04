<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <div class="flex items-center justify-between mb-4">
                <h1 class="text-xl font-bold text-[#1E2761]">Gestion des étudiants</h1>
                <a href="{{ route('etudiants.create') }}" class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                    + Nouvel étudiant
                </a>
            </div>

            <form method="GET" action="{{ route('etudiants.index') }}" class="flex flex-wrap gap-3 mb-4">
                <input type="text" name="recherche" value="{{ request('recherche') }}"
                       placeholder="Rechercher un étudiant..."
                       class="flex-1 min-w-[200px] border-gray-300 rounded-lg text-sm">
                <select name="formation_id" class="border-gray-300 rounded-lg text-sm" onchange="this.form.submit()">
                    <option value="">Formation</option>
                    @foreach ($formations as $formation)
                        <option value="{{ $formation->id }}" @selected(request('formation_id') == $formation->id)>{{ $formation->nom }}</option>
                    @endforeach
                </select>
                <select name="annee_academique_id" class="border-gray-300 rounded-lg text-sm" onchange="this.form.submit()">
                    <option value="">Année</option>
                    @foreach ($annees as $annee)
                        <option value="{{ $annee->id }}" @selected(request('annee_academique_id') == $annee->id)>{{ $annee->libelle }}</option>
                    @endforeach
                </select>
                <button type="submit" class="bg-[#1E2761] text-white text-sm px-4 py-2 rounded-lg">Filtrer</button>
            </form>

            <table class="w-full text-sm border-collapse rounded-lg overflow-hidden bg-white shadow">
                <thead>
                    <tr class="bg-[#1E2761] text-white">
                        <th class="p-3 text-left">Nom &amp; prénom</th>
                        <th class="p-3 text-left">E-mail</th>
                        <th class="p-3 text-left">Formation</th>
                        <th class="p-3 text-left">Année</th>
                        <th class="p-3 text-left">Statut</th>
                        <th class="p-3 text-left w-20"></th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($etudiants as $etudiant)
                        @php $inscription = $etudiant->inscriptions->last(); @endphp
                        <tr class="border-b hover:bg-gray-50 cursor-pointer"
                            onclick="window.location='{{ route('etudiants.show', $etudiant) }}'">
                            <td class="p-3 text-gray-900">{{ $etudiant->nom }} {{ $etudiant->prenom }}</td>
                            <td class="p-3 text-gray-700">{{ $etudiant->email }}</td>
                            <td class="p-3 text-gray-700">{{ $inscription?->formation?->nom ?? '—' }}</td>
                            <td class="p-3 text-gray-700">{{ $inscription?->anneeAcademique?->libelle ?? '—' }}</td>
                            <td class="p-3"><x-statut-badge :statut="$etudiant->statut_etudiant" /></td>
                            <td class="p-3 text-right whitespace-nowrap" onclick="event.stopPropagation()">
                                <a href="{{ route('etudiants.edit', $etudiant) }}" class="text-gray-400 hover:text-blue-600 mr-2">✏️</a>
                                <button type="button" onclick="openDeleteModal('{{ route('etudiants.destroy', $etudiant) }}', '{{ addslashes($etudiant->nom.' '.$etudiant->prenom) }}')" class="text-gray-400 hover:text-red-600">🗑️</button>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="p-6 text-center text-gray-400">Aucun étudiant trouvé.</td></tr>
                    @endforelse
                </tbody>
            </table>

            <div class="mt-4">{{ $etudiants->links() }}</div>
        </div>
    </div>
    @include('partials.confirm-delete-modal')
</x-app-layout>