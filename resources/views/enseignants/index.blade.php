<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <div class="flex items-center justify-between mb-4">
                <h1 class="text-xl font-bold text-[#1E2761]">Gestion des enseignants</h1>
                <a href="{{ route('enseignants.create') }}" class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                    + Nouvel enseignant
                </a>
            </div>

            <table class="w-full text-sm border-collapse rounded-lg overflow-hidden bg-white shadow">
                <thead>
                    <tr class="bg-[#1E2761] text-white">
                        <th class="p-3 text-left">Nom &amp; prénom</th>
                        <th class="p-3 text-left">Spécialité</th>
                        <th class="p-3 text-left">UE affectées</th>
                        <th class="p-3 text-left">Étudiants</th>
                       <th class="p-3 text-left w-20">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($enseignants as $enseignant)
                        <tr class="border-b hover:bg-gray-50 cursor-pointer"
                            onclick="window.location='{{ route('enseignants.show', $enseignant) }}'">
                            <td class="p-3 text-gray-900">{{ $enseignant->nom }} {{ $enseignant->prenom }}</td>
                            <td class="p-3 text-gray-700">{{ $enseignant->specialite }}</td>
                            <td class="p-3">
                                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                    {{ $enseignant->nombre_ue }}
                                </span>
                            </td>
                            <td class="p-3">
                                <span class="inline-flex items-center justify-center px-2 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                    {{ $enseignant->nombre_etudiants }}
                                </span>
                            </td>
                            <td class="p-3 text-right whitespace-nowrap" onclick="event.stopPropagation()">
                                <a href="{{ route('enseignants.edit', $enseignant) }}" class="text-gray-400 hover:text-blue-600 mr-2">✏️</a>
                                <button type="button" onclick="openDeleteModal('{{ route('enseignants.destroy', $enseignant) }}', '{{ addslashes($enseignant->nom.' '.$enseignant->prenom) }}')" class="text-gray-400 hover:text-red-600">🗑️</button>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="p-6 text-center text-gray-400">Aucun enseignant trouvé.</td></tr>
                    @endforelse
                </tbody>
            </table>

            <div class="mt-4">{{ $enseignants->links() }}</div>
        </div>
    </div>
    @include('partials.confirm-delete-modal')
</x-app-layout>