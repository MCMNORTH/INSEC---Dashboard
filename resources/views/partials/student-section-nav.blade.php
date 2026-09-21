<div class="flex flex-wrap gap-2 mb-5" aria-label="Section étudiants">
    <a href="{{ route('etudiants.index') }}" class="px-4 py-2 rounded-lg text-sm font-semibold {{ request()->routeIs('etudiants.*','inscriptions.*','documents.*') ? 'bg-[#1E2761] text-white' : 'bg-white border text-gray-600' }}">Étudiants</a>
    <a href="{{ route('candidatures.index') }}" class="px-4 py-2 rounded-lg text-sm font-semibold {{ request()->routeIs('candidatures.*') ? 'bg-[#1E2761] text-white' : 'bg-white border text-gray-600' }}">Candidatures</a>
</div>
