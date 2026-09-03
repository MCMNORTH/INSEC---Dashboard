<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6 max-w-3xl">
            <a href="{{ route('enseignants.index') }}" class="text-sm text-gray-500">&larr; Retour à la liste</a>

            @if (session('status'))
                <div class="bg-green-50 text-green-700 text-sm p-3 rounded-lg mt-4">
                    {{ session('status') }}
                </div>
            @endif

            <div class="bg-white rounded-xl shadow p-6 mt-4">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-[#1E2761] text-white flex items-center justify-center font-bold">
                            {{ strtoupper(substr($enseignant->prenom, 0, 1) . substr($enseignant->nom, 0, 1)) }}
                        </div>
                        <div>
                            <h1 class="text-lg font-bold text-[#1E2761]">{{ $enseignant->nom }} {{ $enseignant->prenom }}</h1>
                            <p class="text-sm text-gray-500">{{ $enseignant->specialite }}</p>
                        </div>
                    </div>
                    <a href="{{ route('enseignants.edit', $enseignant) }}" class="text-gray-400 hover:text-blue-600 text-xl">✏️</a>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">E-mail</p>
                        <p class="font-medium">{{ $enseignant->email }}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <p class="text-xs text-gray-500">Téléphone</p>
                        <p class="font-medium">{{ $enseignant->telephone ?? '—' }}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow p-6 mt-4">
                <h2 class="text-md font-bold text-[#1E2761] mb-4">UE affectées et étudiants</h2>

                <table class="w-full text-sm border-collapse rounded-lg overflow-hidden mb-4">
                    <thead>
                        <tr class="bg-[#1E2761] text-white">
                            <th class="p-2 text-left">UE</th>
                            <th class="p-2 text-left">Crédits</th>
                            <th class="p-2 text-left">Étudiants</th>
                            <th class="p-2 text-left w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($enseignant->affectations as $affectation)
                            <tr class="border-b">
                                <td class="p-2">{{ $affectation->ue->code }} — {{ $affectation->ue->libelle }}</td>
                                <td class="p-2">{{ $affectation->ue->credits }}</td>
                                <td class="p-2">{{ $affectation->nombre_etudiants }}</td>
                                <td class="p-2 text-right">
                                    <button type="button" onclick="openDeleteModal('{{ route('affectations.destroy', $affectation) }}', '{{ addslashes($affectation->ue->libelle) }}')" class="text-gray-400 hover:text-red-600">🗑️</button>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="4" class="p-4 text-center text-gray-400">Aucune UE affectée.</td></tr>
                        @endforelse
                    </tbody>
                </table>

                @if ($uesDisponibles->isNotEmpty())
                    <form method="POST" action="{{ route('enseignants.affectations.store', $enseignant) }}" class="flex flex-wrap items-end gap-3 border-t pt-4">
                        @csrf
                        <div class="flex-1 min-w-[180px]">
                            <label class="text-xs text-gray-500">UE à affecter</label>
                            <select name="ue_id" class="w-full border-gray-300 rounded-lg mt-1" required>
                                @foreach ($uesDisponibles as $ue)
                                    <option value="{{ $ue->id }}">{{ $ue->code }} — {{ $ue->libelle }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="w-32">
                            <label class="text-xs text-gray-500">Étudiants</label>
                            <input type="number" name="nombre_etudiants" min="0" value="0" class="w-full border-gray-300 rounded-lg mt-1" required>
                        </div>
                        <button type="submit" class="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                            + Ajouter
                        </button>
                    </form>
                @else
                    <p class="text-sm text-gray-400 border-t pt-4">Toutes les UE sont déjà affectées à cet enseignant.</p>
                @endif
            </div>
        </div>
    </div>

    @include('partials.confirm-delete-modal')
</x-app-layout>