<x-app-layout>
    <div class="p-6">
        <h1 class="text-xl font-bold text-[#1E2761] mb-4">Gestion des étudiants</h1>
        <table class="w-full text-sm border-collapse rounded-lg overflow-hidden">
            <thead>
                <tr class="bg-[#1E2761] text-white">
                    <th class="p-3 text-left">Nom &amp; prénom</th>
                    <th class="p-3 text-left">E-mail</th>
                    <th class="p-3 text-left">Statut</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($etudiants as $etudiant)
                    <tr class="border-b hover:bg-gray-50 cursor-pointer"
                        onclick="window.location='{{ route('etudiants.show', $etudiant) }}'">
                        <td class="p-3">{{ $etudiant->nom }} {{ $etudiant->prenom }}</td>
                        <td class="p-3">{{ $etudiant->email }}</td>
                        <td class="p-3">{{ $etudiant->statut_etudiant }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
        <div class="mt-4">{{ $etudiants->links() }}</div>
    </div>
</x-app-layout>