<x-app-layout>
<div class="flex min-h-screen bg-gray-100">@include('partials.sidebar')
<main class="flex-1 p-6">
    <a href="{{ route('etudiants.index') }}" class="text-sm text-gray-500">&larr; Retour à la liste</a>
    @if(session('status'))<div class="bg-green-50 text-green-700 p-3 rounded-lg mt-4">{{ session('status') }}</div>@endif
    <section class="bg-white rounded-xl shadow p-6 mt-4">
        <div class="flex flex-wrap justify-between gap-4"><div><h1 class="text-lg font-bold text-[#1E2761]">{{ $etudiant->prenom }} {{ $etudiant->nom }}</h1><x-statut-badge :statut="$etudiant->statut_etudiant" /><p class="text-sm text-gray-500 mt-2">{{ $etudiant->email }} · {{ $etudiant->telephone ?? '—' }}</p></div><div class="flex gap-2"><a href="{{ route('etudiants.edit',$etudiant) }}" class="bg-gray-100 px-4 py-2 rounded-lg">Modifier l’identité</a><a href="{{ route('etudiants.inscriptions.create',$etudiant) }}" class="bg-amber-500 text-white px-4 py-2 rounded-lg">Nouvelle inscription</a></div></div>
    </section>
    <h2 class="text-lg font-bold text-[#1E2761] mt-8 mb-3">Historique des inscriptions</h2>
    <div class="space-y-4">
        @forelse($etudiant->inscriptions as $inscription)
            <article class="bg-white rounded-xl shadow p-5">
                <div class="flex justify-between gap-3"><div><h3 class="font-semibold text-[#1E2761]">{{ $inscription->formation?->code }} — {{ $inscription->anneeAcademique?->libelle }}</h3><p class="text-sm text-gray-500">Année {{ $inscription->annee_parcours ?? '—' }} · {{ ucfirst($inscription->statut) }} · N° INTEC {{ $inscription->numero_inscription_intec ?? '—' }}</p></div><a href="{{ route('inscriptions.edit',$inscription) }}" class="text-sm text-blue-700">Modifier</a></div>
                <div class="flex flex-wrap gap-2 mt-4">@forelse($inscription->ues as $ue)<span class="bg-blue-50 text-blue-800 rounded-full px-3 py-1 text-sm">{{ $ue->code }} · {{ $ue->libelle }}</span>@empty<span class="text-sm text-amber-700">Aucune UE renseignée.</span>@endforelse</div>
                <div class="mt-4 border-t pt-3 text-sm"><strong>Finances :</strong> {{ number_format($inscription->total_verse,0,',',' ') }} / {{ number_format($inscription->montant_net,0,',',' ') }} MRU · Solde {{ number_format($inscription->solde_restant,0,',',' ') }} MRU</div>
            </article>
        @empty<div class="bg-white rounded-xl p-6 text-gray-500">Aucune inscription.</div>@endforelse
    </div>
    @include('etudiants._academic-progress')
</main></div>
</x-app-layout>
