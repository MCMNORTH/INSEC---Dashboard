<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Tableau de bord') }}
        </h2>
    </x-slot>

    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <h1 class="text-xl font-bold text-[#1E2761] mb-4">Tableau de bord</h1>

            <div class="bg-white rounded-xl shadow p-6">
                Vous êtes connecté !
            </div>

            {{-- Espace réservé pour les statistiques et graphiques (stagiaire) --}}
        </div>
    </div>
</x-app-layout>