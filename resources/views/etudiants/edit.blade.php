<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6 max-w-2xl">
            <a href="{{ route('etudiants.show', $etudiant) }}" class="text-sm text-gray-500">&larr; Retour à la fiche</a>
            <h1 class="text-xl font-bold text-[#1E2761] mt-2 mb-6">Modifier l'étudiant</h1>

            @if ($errors->any())
                <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
                    <ul class="list-disc list-inside">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            @php $inscription = $etudiant->inscriptions->last(); @endphp

            <form method="POST" action="{{ route('etudiants.update', $etudiant) }}" class="bg-white rounded-xl shadow p-6 space-y-4">
                @csrf
                @method('PUT')

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm text-gray-600">Nom</label>
                        <input type="text" name="nom" value="{{ old('nom', $etudiant->nom) }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                    <div>
                        <label class="text-sm text-gray-600">Prénom</label>
                        <input type="text" name="prenom" value="{{ old('prenom', $etudiant->prenom) }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm text-gray-600">E-mail</label>
                        <input type="email" name="email" value="{{ old('email', $etudiant->email) }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                    <div>
                        <label class="text-sm text-gray-600">Téléphone</label>
                        <input type="text" name="telephone" value="{{ old('telephone', $etudiant->telephone) }}" class="w-full border-gray-300 rounded-lg mt-1">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm text-gray-600">Formation</label>
                        <select name="formation_id" class="w-full border-gray-300 rounded-lg mt-1" required>
                            @foreach ($formations as $formation)
                                <option value="{{ $formation->id }}" @selected(old('formation_id', $inscription?->id_formation) == $formation->id)>{{ $formation->nom }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label class="text-sm text-gray-600">Année académique</label>
                        <select name="annee_academique_id" class="w-full border-gray-300 rounded-lg mt-1" required>
                            @foreach ($annees as $annee)
                                <option value="{{ $annee->id }}" @selected(old('annee_academique_id', $inscription?->id_annee_academique) == $annee->id)>{{ $annee->libelle }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>

                <div>
                    <label class="text-sm text-gray-600">Statut</label>
                    <select name="statut_etudiant" class="w-full border-gray-300 rounded-lg mt-1" required>
                        @foreach (['Actif', 'Suspendu', 'Diplômé', 'Abandon'] as $statut)
                            <option value="{{ $statut }}" @selected(old('statut_etudiant', $etudiant->statut_etudiant) == $statut)>{{ $statut }}</option>
                        @endforeach
                    </select>
                </div>

                <div class="pt-2">
                    <button type="submit" class="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg">
                        Enregistrer
                    </button>
                </div>
            </form>

            
        </div>
    </div>
</x-app-layout>