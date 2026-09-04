<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <h1 class="text-xl font-bold text-[#1E2761] mb-4">Finances</h1>

            @if (session('status'))
                <div class="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4">{{ session('status') }}</div>
            @endif
            @if (session('error'))
                <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{{ session('error') }}</div>
            @endif

            <div class="flex gap-2 mb-4">
                <button onclick="showTab('etudiants')" id="tab-etudiants" class="px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white">
                    Étudiants
                </button>
                <button onclick="showTab('reversement')" id="tab-reversement" class="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border">
                    Reversement INTEC
                </button>
            </div>

            {{-- Onglet Étudiants --}}
            <div id="panel-etudiants" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div class="lg:col-span-2 bg-white rounded-xl shadow overflow-hidden">
                    <div class="p-3 border-b space-y-2">
                        <input type="text" id="rechercheEtudiant" onkeyup="filtrerEtudiants()" placeholder="🔍 Rechercher un étudiant par nom..." class="w-full rounded-lg border-gray-300 text-sm">
                        <div class="flex gap-2">
                            <button type="button" onclick="filtrerParStatut('tous', this)" class="filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-[#1E2761] text-white">Tous</button>
                            <button type="button" onclick="filtrerParStatut('Soldé', this)" class="filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Soldé</button>
                            <button type="button" onclick="filtrerParStatut('Partiel', this)" class="filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Partiel</button>
                            <button type="button" onclick="filtrerParStatut('Impayé', this)" class="filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Impayé</button>
                        </div>
                    </div>
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-[#1E2761] text-white">
                                <th class="p-3 text-left">Étudiant</th>
                                <th class="p-3 text-left">Restant</th>
                                <th class="p-3 text-left">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($etudiants as $etudiant)
                                @php
                                    $inscription = $etudiant->inscriptions->last();
                                    $statut = $inscription?->statut_paiement ?? 'Non inscrit';
                                @endphp
                                <tr class="ligne-etudiant border-b hover:bg-gray-50 cursor-pointer {{ $etudiantSelectionne?->id_etudiant === $etudiant->id_etudiant ? 'bg-blue-50' : '' }}"
                                    data-nom="{{ strtolower($etudiant->nom.' '.$etudiant->prenom) }}"
                                    data-statut="{{ $statut }}"
                                    onclick="window.location='{{ route('finances.index', ['etudiant' => $etudiant->id_etudiant]) }}'">
                                    <td class="p-3 text-gray-900">{{ $etudiant->nom }} {{ $etudiant->prenom }}</td>
                                    <td class="p-3 text-gray-700">{{ number_format($inscription?->solde_restant ?? 0, 0, ',', ' ') }}</td>
                                    <td class="p-3">
                                        @php
                                            $styles = ['Soldé' => 'bg-green-100 text-green-700', 'Partiel' => 'bg-amber-100 text-amber-700', 'Impayé' => 'bg-red-100 text-red-700'];
                                        @endphp
                                        <span class="inline-block px-3 py-1 text-xs font-medium rounded-full {{ $styles[$statut] ?? 'bg-gray-100 text-gray-700' }}">
                                            {{ $statut }}
                                        </span>
                                    </td>
                                </tr>
                            @empty
                                <tr><td colspan="3" class="p-6 text-center text-gray-400">Aucun étudiant.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                    <p class="text-xs text-gray-400 p-3">👆 Clique sur un étudiant pour ouvrir son dossier</p>
                </div>

                @if ($etudiantSelectionne)
                    <div class="bg-[#1E2761] text-white rounded-xl shadow p-5">
                        <p class="text-amber-400 text-xs font-bold uppercase tracking-wide">Inscription — {{ $etudiantSelectionne->nom }} {{ $etudiantSelectionne->prenom }}</p>

                        @if ($inscriptionSelectionnee)
                            <p class="text-xs text-blue-200 mt-4">Montant dû (année)</p>
                            <p class="text-2xl font-bold">{{ number_format($inscriptionSelectionnee->montant_du, 0, ',', ' ') }} MRU</p>

                            <p class="text-xs text-blue-200 mt-4">Total versé</p>
                            <p class="text-lg font-bold text-green-400">{{ number_format($inscriptionSelectionnee->total_verse, 0, ',', ' ') }} MRU</p>

                            <p class="text-xs text-blue-200 mt-4">Solde restant (calculé)</p>
                            <p class="text-lg font-bold text-amber-400">{{ number_format($inscriptionSelectionnee->solde_restant, 0, ',', ' ') }} MRU</p>

                            <a href="{{ route('finances.facture', $etudiantSelectionne) }}" target="_blank" class="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-lg mt-4">
                                📄 Voir / Imprimer la facture
                            </a>

                            <form method="POST" action="{{ route('finances.montant.update', $etudiantSelectionne) }}" class="border-t border-blue-400/30 mt-4 pt-4 flex items-end gap-2">
                                @csrf
                                <div class="flex-1">
                                    <label class="text-xs text-blue-200">Modifier le montant dû</label>
                                    <input type="number" name="montant_du" min="0" value="{{ $inscriptionSelectionnee->montant_du }}" class="w-full rounded-lg mt-1 text-gray-900" required>
                                </div>
                                <button type="submit" class="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg">
                                    Modifier
                                </button>
                            </form>

                            <div class="border-t border-blue-400/30 mt-4 pt-4">
                                <p class="text-xs text-blue-200 mb-2">Derniers versements</p>
                                <div class="space-y-2 mb-4">
                                    @forelse ($inscriptionSelectionnee->versements->sortByDesc('date_versement') as $versement)
                                        <div class="bg-white/10 rounded-lg px-3 py-2 text-xs">
                                            <div class="flex items-center justify-between mb-1">
                                                <span>{{ \Carbon\Carbon::parse($versement->date_versement)->format('d/m/Y') }}</span>
                                                <span>{{ number_format($versement->montant, 0, ',', ' ') }}</span>
                                                <span class="{{ $versement->statut === 'Validée' ? 'text-green-400' : 'text-amber-400' }}">{{ $versement->statut }}</span>
                                            </div>
                                            <div class="flex gap-2 justify-end mt-1">
                                                <button type="button" onclick="document.getElementById('edit-versement-{{ $versement->id }}').classList.toggle('hidden')" class="text-blue-200 hover:text-white underline">
                                                    Modifier
                                                </button>
                                                <form method="POST" action="{{ route('finances.versements.destroy', $versement) }}" onsubmit="return confirm('Supprimer ce versement ?');">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="text-red-300 hover:text-red-100 underline">
                                                        Supprimer
                                                    </button>
                                                </form>
                                            </div>
                                            <form id="edit-versement-{{ $versement->id }}" method="POST" action="{{ route('finances.versements.update', $versement) }}" class="hidden mt-2 space-y-1 bg-white/10 p-2 rounded-lg">
                                                @csrf
                                                @method('PUT')
                                                <input type="number" name="montant" min="1" value="{{ $versement->montant }}" class="w-full rounded-lg text-gray-900 text-xs" required>
                                                <input type="date" name="date_versement" value="{{ $versement->date_versement }}" class="w-full rounded-lg text-gray-900 text-xs" required>
                                                <select name="statut" class="w-full rounded-lg text-gray-900 text-xs" required>
                                                    <option value="Validée" @selected($versement->statut === 'Validée')>Validée</option>
                                                    <option value="En attente" @selected($versement->statut === 'En attente')>En attente</option>
                                                </select>
                                                <button type="submit" class="w-full bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-lg">
                                                    Enregistrer
                                                </button>
                                            </form>
                                        </div>
                                    @empty
                                        <p class="text-xs text-blue-200">Aucun versement.</p>
                                    @endforelse
                                </div>

                                <form method="POST" action="{{ route('finances.versements.store', $etudiantSelectionne) }}" class="space-y-2">
                                    @csrf
                                    <p class="text-xs text-blue-200">Ajouter un versement</p>
                                    <div class="flex gap-2">
                                        <input type="number" name="montant" min="1" placeholder="Montant" class="w-1/2 rounded-lg text-gray-900 text-xs" required>
                                        <input type="date" name="date_versement" class="w-1/2 rounded-lg text-gray-900 text-xs" required>
                                    </div>
                                    <select name="statut" class="w-full rounded-lg text-gray-900 text-xs" required>
                                        <option value="Validée">Validée</option>
                                        <option value="En attente">En attente</option>
                                    </select>
                                    <button type="submit" class="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg">
                                        + Ajouter le versement
                                    </button>
                                </form>
                            </div>
                        @else
                            <p class="text-sm text-blue-200 mt-4">
                                Cet étudiant n'a pas encore de formation/année assignée.
                                <a href="{{ route('etudiants.edit', $etudiantSelectionne) }}" class="underline text-amber-400">Compléter sa fiche</a>
                            </p>
                        @endif
                    </div>
                @endif
            </div>

            {{-- Onglet Reversement INTEC --}}
            <div id="panel-reversement" class="hidden">
                <form method="GET" action="{{ route('finances.index') }}" class="mb-4 flex items-center gap-3">
                    <input type="hidden" name="tab" value="reversement">
                    <label class="text-sm text-gray-600">Année académique :</label>
                    <select name="annee_reversement" onchange="this.form.submit()" class="border-gray-300 rounded-lg text-sm">
                        @foreach ($annees as $annee)
                            <option value="{{ $annee->id }}" @selected($anneeSelectionneeId == $annee->id)>{{ $annee->libelle }}</option>
                        @endforeach
                    </select>
                </form>

                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Étudiants concernés</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ $carteReversement->nb_etudiants ?? 0 }}</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Montant dû à l'INTEC</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ number_format(($carteReversement->montant_du ?? 0) / 1000000, 1) }} M MRU</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Déjà reversé</p>
                        <p class="text-xl font-bold text-green-600">{{ number_format(($carteReversement->reverse ?? 0) / 1000000, 1) }} M MRU</p>
                    </div>
                </div>

                <table class="w-full text-sm border-collapse rounded-lg overflow-hidden bg-white shadow">
                    <thead>
                        <tr class="bg-[#1E2761] text-white">
                            <th class="p-3 text-left">Année académique</th>
                            <th class="p-3 text-left">Étudiants</th>
                            <th class="p-3 text-left">Montant dû</th>
                            <th class="p-3 text-left">Reversé</th>
                            <th class="p-3 text-left">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        @php $styles = ['Soldé' => 'bg-green-100 text-green-700', 'Partiel' => 'bg-amber-100 text-amber-700', 'Impayé' => 'bg-red-100 text-red-700']; @endphp
                        @forelse ($anneesAvecDonnees as $annee)
                            <tr class="border-b">
                                <td class="p-3">{{ $annee->libelle }}</td>
                                <td class="p-3">{{ $annee->nb_etudiants }}</td>
                                <td class="p-3">{{ number_format($annee->montant_du, 0, ',', ' ') }}</td>
                                <td class="p-3">{{ number_format($annee->reverse, 0, ',', ' ') }}</td>
                                <td class="p-3">
                                    <span class="inline-block px-3 py-1 text-xs font-medium rounded-full {{ $styles[$annee->statut] }}">
                                        {{ $annee->statut }}
                                    </span>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="5" class="p-6 text-center text-gray-400">Aucune donnée.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let statutActif = 'tous';

        function filtrerEtudiants() {
            const recherche = document.getElementById('rechercheEtudiant').value.toLowerCase();
            document.querySelectorAll('.ligne-etudiant').forEach(function (ligne) {
                const nom = ligne.getAttribute('data-nom');
                const statut = ligne.getAttribute('data-statut');
                const matchNom = nom.includes(recherche);
                const matchStatut = statutActif === 'tous' || statut === statutActif;
                ligne.style.display = (matchNom && matchStatut) ? '' : 'none';
            });
        }

        function filtrerParStatut(statut, bouton) {
            statutActif = statut;
            document.querySelectorAll('.filtre-statut').forEach(function (btn) {
                btn.className = 'filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600';
            });
            bouton.className = 'filtre-statut px-3 py-1 rounded-full text-xs font-medium bg-[#1E2761] text-white';
            filtrerEtudiants();
        }

        function showTab(tab) {
            document.getElementById('panel-etudiants').classList.toggle('hidden', tab !== 'etudiants');
            document.getElementById('panel-reversement').classList.toggle('hidden', tab !== 'reversement');
            document.getElementById('tab-etudiants').className = tab === 'etudiants'
                ? 'px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white'
                : 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border';
            document.getElementById('tab-reversement').className = tab === 'reversement'
                ? 'px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white'
                : 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border';
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'reversement') {
            showTab('reversement');
        }
    </script>
</x-app-layout>