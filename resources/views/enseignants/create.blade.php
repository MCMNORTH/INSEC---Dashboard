<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6 max-w-2xl">
            <a href="{{ route('enseignants.index') }}" class="text-sm text-gray-500">&larr; Retour à la liste</a>
            <h1 class="text-xl font-bold text-[#1E2761] mt-2 mb-6">Nouvel enseignant</h1>

            @if ($errors->any())
                <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
                    <ul class="list-disc list-inside">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('enseignants.store') }}" class="bg-white rounded-xl shadow p-6 space-y-4">
                @csrf

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm text-gray-600">Nom</label>
                        <input type="text" name="nom" value="{{ old('nom') }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                    <div>
                        <label class="text-sm text-gray-600">Prénom</label>
                        <input type="text" name="prenom" value="{{ old('prenom') }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                </div>

                <div>
                    <label class="text-sm text-gray-600">Spécialité</label>
                    <input type="text" name="specialite" value="{{ old('specialite') }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm text-gray-600">E-mail</label>
                        <input type="email" name="email" value="{{ old('email') }}" class="w-full border-gray-300 rounded-lg mt-1" required>
                    </div>
                    <div>
                        <label class="text-sm text-gray-600">Téléphone</label>
                        <input type="text" name="telephone" value="{{ old('telephone') }}" class="w-full border-gray-300 rounded-lg mt-1">
                    </div>
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