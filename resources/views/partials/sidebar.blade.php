<aside class="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
    <div class="mb-8">
        <p class="text-[#1E2761] font-bold text-lg">INSEC</p>
        <p class="text-xs text-gray-400">Espace admin</p>
    </div>
    <nav class="space-y-1">
        <a href="{{ route('dashboard') }}" class="block px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('dashboard') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}">
            Tableau de bord
        </a>
        <a href="{{ route('etudiants.index') }}" class="block px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('etudiants.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}">
            Étudiants
        </a>
        <span class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">Enseignants</span>
        <span class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed">Finances</span>
    </nav>
</aside>