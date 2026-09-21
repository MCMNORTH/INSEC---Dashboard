<x-app-layout>
<div class="flex min-h-screen bg-gray-100">
    @include('partials.sidebar')
    <main class="flex-1 p-6 lg:p-8 min-w-0">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div><p class="text-sm text-gray-500">Continuité d’activité</p><h1 class="text-2xl font-bold text-[#1E2761]">Sauvegardes et restauration</h1><p class="text-sm text-gray-500 mt-1">Base de données, dossiers étudiants et contrôle d’intégrité dans une archive unique.</p></div>
            @if($sqlite)<form method="POST" action="{{ route('backups.store') }}">@csrf<button class="bg-[#1E2761] text-white rounded-lg px-4 py-2 text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Créer une sauvegarde</button></form>@endif
        </div>
        @if(session('success'))<div class="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">{{ session('success') }}</div>@endif
        @if(session('error'))<div class="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{{ session('error') }}</div>@endif
        @unless($sqlite)<div class="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">La sauvegarde intégrée est disponible uniquement avec SQLite. Utilisez l’outil natif de votre moteur de base de données.</div>@endunless
        <div class="grid md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white border rounded-xl p-4"><p class="text-xs text-gray-400">Planification</p><p class="font-semibold text-[#1E2761] mt-1">Tous les jours à 02:00</p></div>
            <div class="bg-white border rounded-xl p-4"><p class="text-xs text-gray-400">Conservation</p><p class="font-semibold text-[#1E2761] mt-1">30 jours</p></div>
            <div class="bg-white border rounded-xl p-4"><p class="text-xs text-gray-400">Protection</p><p class="font-semibold text-[#1E2761] mt-1">SHA-256 + mot de passe</p></div>
        </div>
        <div class="space-y-3">
            @forelse($sauvegardes as $backup)
            <article class="bg-white border rounded-xl p-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div><div class="flex items-center gap-2"><h2 class="font-semibold text-[#1E2761]">{{ $backup['nom'] }}</h2><span class="text-xs rounded-full px-2 py-1 {{ $backup['integrite']?'bg-green-50 text-green-700':'bg-red-50 text-red-700' }}">{{ $backup['integrite']?'Intègre':'À vérifier' }}</span></div><p class="text-xs text-gray-400 mt-1">{{ \Illuminate\Support\Carbon::parse($backup['cree_le'])->format('d/m/Y à H:i:s') }} · {{ number_format($backup['taille']/1024, 1, ',', ' ') }} Ko · {{ $backup['documents'] }} document(s) · {{ $backup['motif'] }}</p></div>
                    <div class="flex flex-wrap gap-2">
                        <form method="POST" action="{{ route('backups.verify',$backup['nom']) }}">@csrf<button class="border rounded-lg px-3 py-2 text-xs font-semibold text-gray-600">Vérifier</button></form>
                        <a href="{{ route('backups.download',$backup['nom']) }}" class="border rounded-lg px-3 py-2 text-xs font-semibold text-gray-600">Télécharger</a>
                        <button type="button" onclick="document.getElementById('restore-{{ $loop->index }}').classList.toggle('hidden')" class="bg-red-600 text-white rounded-lg px-3 py-2 text-xs font-semibold">Restaurer</button>
                    </div>
                </div>
                <form id="restore-{{ $loop->index }}" method="POST" action="{{ route('backups.restore',$backup['nom']) }}" class="hidden mt-4 border-t pt-4 grid md:grid-cols-3 gap-3 items-end">@csrf<div><label class="text-xs font-semibold text-gray-600">Mot de passe du compte</label><input type="password" name="password" required autocomplete="current-password" class="mt-1 w-full rounded-lg border-gray-300 text-sm"></div><div><label class="text-xs font-semibold text-gray-600">Tapez RESTAURER</label><input name="confirmation" required class="mt-1 w-full rounded-lg border-gray-300 text-sm"></div><button class="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-semibold">Confirmer la restauration</button></form>
            </article>
            @empty<div class="bg-white border rounded-xl p-10 text-center text-gray-400">Aucune sauvegarde disponible.</div>@endforelse
        </div>
    </main>
</div>
</x-app-layout>
