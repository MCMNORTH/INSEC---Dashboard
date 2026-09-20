<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Alertes — INSEC</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
</head>
<body class="bg-gray-50 text-gray-800">
<div class="min-h-screen {{ in_array(auth()->user()->role, ['admin','super_admin','finance'], true) ? 'flex' : '' }}">
    @if(in_array(auth()->user()->role, ['admin','super_admin','finance'], true))
        @include('partials.sidebar')
    @else
        <div class="w-full">
            @include('portails._header', ['espace' => auth()->user()->role === 'etudiant' ? 'Espace étudiant' : 'Espace enseignant'])
    @endif
    <main class="flex-1 p-6 lg:p-10">
        <div class="max-w-5xl mx-auto">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-7">
                <div><h1 class="text-2xl font-bold text-[#1E2761]">Centre d’alertes</h1><p class="text-sm text-gray-500 mt-1">Échéances, examens, documents et résultats importants.</p></div>
                <form method="POST" action="{{ route('alertes.tout-lire') }}">@csrf @method('PUT')<button class="border border-gray-300 bg-white px-4 py-2 rounded-lg text-sm hover:bg-gray-50"><i class="fa-solid fa-check-double mr-2"></i>Tout marquer comme lu</button></form>
            </div>
            @if(session('success'))<div class="mb-5 rounded-lg bg-green-50 text-green-800 px-4 py-3">{{ session('success') }}</div>@endif
            <div class="space-y-3">
                @forelse($alertes as $alerte)
                    @php($styles = ['danger' => ['bg-red-50','text-red-700','fa-circle-exclamation'], 'warning' => ['bg-amber-50','text-amber-700','fa-triangle-exclamation'], 'success' => ['bg-green-50','text-green-700','fa-circle-check'], 'info' => ['bg-blue-50','text-blue-700','fa-circle-info']][$alerte->niveau] ?? ['bg-gray-50','text-gray-700','fa-bell'])
                    <article class="bg-white border {{ $alerte->lue_at ? 'border-gray-200 opacity-75' : 'border-[#D4AF37]' }} rounded-xl p-5 flex gap-4">
                        <div class="w-11 h-11 shrink-0 rounded-full {{ $styles[0] }} {{ $styles[1] }} flex items-center justify-center"><i class="fa-solid {{ $styles[2] }}"></i></div>
                        <div class="flex-1 min-w-0"><div class="flex justify-between gap-3"><h2 class="font-semibold text-[#1E2761]">{{ $alerte->titre }}</h2><span class="text-xs text-gray-400 whitespace-nowrap">{{ $alerte->updated_at->diffForHumans() }}</span></div><p class="text-sm text-gray-600 mt-1">{{ $alerte->message }}</p><div class="flex gap-4 mt-3">
                            <form method="POST" action="{{ route('alertes.lire', $alerte) }}">@csrf @method('PUT')<button class="text-sm font-semibold text-[#1E2761]">{{ $alerte->lien ? 'Consulter' : 'Marquer comme lue' }} <i class="fa-solid fa-arrow-right ml-1"></i></button></form>
                            <form method="POST" action="{{ route('alertes.archiver', $alerte) }}">@csrf @method('PUT')<button class="text-sm text-gray-400 hover:text-gray-700">Archiver</button></form>
                        </div></div>
                    </article>
                @empty
                    <div class="bg-white rounded-xl border border-gray-200 p-12 text-center"><i class="fa-regular fa-bell text-4xl text-gray-300"></i><p class="font-semibold mt-4">Aucune alerte active</p><p class="text-sm text-gray-500 mt-1">Tout est à jour pour le moment.</p></div>
                @endforelse
            </div>
            <div class="mt-6">{{ $alertes->links() }}</div>
        </div>
    </main>
    @unless(in_array(auth()->user()->role, ['admin','super_admin','finance'], true))</div>@endunless
</div>
</body></html>
