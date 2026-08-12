<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <div class="flex items-center justify-between mb-4">
                <h1 class="text-xl font-bold text-[#1E2761]">Gestion des étudiants</h1>
                <a href="{{ route('etudiants.create') }}" class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm">
                    + Nouvel étudiant
                </a>
            </div>

            <!-- Barre de Recherche et Filtres -->
            <form method="GET" action="{{ route('etudiants.index') }}" class="flex gap-2 mb-4">
                <input type="text" name="search" value="{{ request('search') }}" placeholder="Rechercher un étudiant..." class="flex-1 border-gray-300 rounded-lg text-sm focus:ring-blue-500">
                
                <select name="formation_id" class="border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-blue-500">
                    <option value="">Formation</option>
                    @foreach($formations as $formation)
                        <option value="{{ $formation->id }}" @selected(request('formation_id') == $formation->id)>{{ $formation->nom }}</option>
                    @endforeach
                </select>

                <select name="annee_id" class="border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-blue-500">
                    <option value="">Année</option>
                    @foreach($annees as $annee)
                        <option value="{{ $annee->id }}" @selected(request('annee_id') == $annee->id)>{{ $annee->libelle }}</option>
                    @endforeach
                </select>

                <button type="submit" class="bg-[#1E2761] text-white text-sm px-4 py-2 rounded-lg font-medium">Filtrer</button>
            </form>

            <!-- Tableau -->
            <div class="bg-white rounded-xl shadow overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-[#1E2761] text-white text-sm">
                            <th class="p-3">Nom & prénom</th>
                            <th class="p-3">E-mail</th>
                            <th class="p-3">Formation</th>
                            <th class="p-3">Année</th>
                            <th class="p-3">Statut</th>
                            <th class="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 text-sm">
                        @forelse ($etudiants as $etudiant)
                            @php $derniereInscription = $etudiant->inscriptions->last(); @endphp
                            <tr class="hover:bg-gray-50 transition">
                                <td class="p-3 font-medium text-gray-800">{{ $etudiant->nom }} {{ $etudiant->prenom }}</td>
                                <td class="p-3 text-gray-600">{{ $etudiant->email }}</td>
                                <td class="p-3 text-gray-600">{{ $derniereInscription?->formation?->nom ?? '-' }}</td>
                                <td class="p-3 text-gray-600">{{ $derniereInscription?->anneeAcademique?->libelle ?? '-' }}</td>
                                <td class="p-3">
                                    <span class="px-2.5 py-1 text-xs rounded-full font-medium
                                        {{ $etudiant->statut_etudiant === 'Actif' ? 'bg-emerald-100 text-emerald-700' : '' }}
                                        {{ $etudiant->statut_etudiant === 'Suspendu' ? 'bg-amber-100 text-amber-700' : '' }}
                                        {{ $etudiant->statut_etudiant === 'Diplômé' ? 'bg-blue-100 text-blue-700' : '' }}
                                        {{ $etudiant->statut_etudiant === 'Abandon' ? 'bg-red-100 text-red-700' : '' }}">
                                        {{ $etudiant->statut_etudiant }}
                                    </span>
                                </td>
                                <td class="p-3 text-right whitespace-nowrap">
                                    <a href="{{ route('etudiants.edit', $etudiant) }}" class="text-gray-400 hover:text-blue-600 mr-2">✏️</a>
                                    <button type="button" 
                                            onclick="confirmDelete('{{ route('etudiants.destroy', $etudiant) }}', '{{ addslashes($etudiant->nom.' '.$etudiant->prenom) }}')" 
                                            class="text-gray-400 hover:text-red-600">
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="p-4 text-center text-gray-400">Aucun étudiant trouvé.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="mt-4">
                {{ $etudiants->links() }}
            </div>
        </div>
    </div>

    <!-- MODAL DE CONFIRMATION DE SUPPRESSION (Conforme à votre Image 3) -->
    <div id="deleteModal" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl transform transition-all">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold">
                    ⚠️
                </div>
                <h3 class="text-lg font-bold text-red-600">Confirmer la suppression</h3>
            </div>
            
            <p class="text-sm text-gray-600 mb-6">
                Voulez-vous vraiment supprimer <span id="deleteItemName" class="font-semibold text-gray-800"></span> ? Cette action est irréversible.
            </p>

            <form id="deleteForm" method="POST" action="">
                @csrf
                @method('DELETE')
                <div class="flex justify-end gap-3">
                    <button type="button" onclick="closeDeleteModal()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
                        Annuler
                    </button>
                    <button type="submit" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm">
                        Supprimer
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
        function confirmDelete(actionUrl, name) {
            document.getElementById('deleteForm').action = actionUrl;
            document.getElementById('deleteItemName').innerText = name;
            document.getElementById('deleteModal').classList.remove('hidden');
            document.getElementById('deleteModal').classList.add('flex');
        }

        function closeDeleteModal() {
            document.getElementById('deleteModal').classList.add('hidden');
            document.getElementById('deleteModal').classList.remove('flex');
        }
    </script>
</x-app-layout>