<x-app-layout><div class="flex min-h-screen bg-gray-100">@include('partials.sidebar')
<main class="flex-1 p-6 lg:p-8 min-w-0">
    <div class="mb-7"><p class="text-sm text-gray-500">Outils avancés</p><h1 class="text-2xl font-bold text-[#1E2761]">Administration</h1><p class="text-sm text-gray-500 mt-1">Ces fonctions sont utilisées ponctuellement et restent séparées du travail quotidien.</p></div>
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
        @foreach([
            ['comptes.index','fa-users-gear','Comptes et accès','Créer les comptes et contrôler les rôles.'],
            ['excel.index','fa-file-excel','Imports et exports','Importer ou exporter les données structurées.'],
            ['communications.index','fa-envelope','Communications','Contrôler les courriels envoyés par le système.'],
            ['audit.index','fa-clock-rotate-left','Journal d’audit','Retrouver les opérations sensibles et leurs auteurs.'],
        ] as $outil)
            <a href="{{ route($outil[0]) }}" class="bg-white border rounded-xl p-5 hover:border-[#D4AF37] flex gap-4"><span class="w-10 h-10 shrink-0 rounded-lg bg-gray-50 text-[#1E2761] flex items-center justify-center"><i class="fa-solid {{ $outil[1] }}"></i></span><span><strong class="block text-[#1E2761]">{{ $outil[2] }}</strong><span class="block text-sm text-gray-500 mt-1">{{ $outil[3] }}</span></span></a>
        @endforeach
        @if(auth()->user()->role === 'super_admin')
            <a href="{{ route('backups.index') }}" class="bg-white border rounded-xl p-5 hover:border-[#D4AF37] flex gap-4"><span class="w-10 h-10 shrink-0 rounded-lg bg-red-50 text-red-700 flex items-center justify-center"><i class="fa-solid fa-database"></i></span><span><strong class="block text-[#1E2761]">Sauvegardes</strong><span class="block text-sm text-gray-500 mt-1">Créer, vérifier et restaurer les archives.</span></span></a>
        @endif
    </div>
</main></div></x-app-layout>
