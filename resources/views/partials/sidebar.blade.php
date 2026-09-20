<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
<aside class="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
    <div class="mb-8 text-center">
        <img src="{{ asset('images/logo-insec.png') }}" alt="Logo INSEC" class="w-20 h-20 mx-auto object-contain mb-2">
        <div class="border-t-2 border-[#D4AF37] w-12 mx-auto"></div>
        <p class="text-[#1E2761] font-bold text-xl mt-3">INSEC</p>
        <p class="text-xs text-gray-400 mb-7">{{ auth()->user()->role === 'finance' ? 'Espace finance' : 'Espace administration' }}</p>
    </div>
    <nav class="space-y-1">
        <a href="{{ route('dashboard') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"><i class="fa-solid fa-table-cells-large w-4 text-center"></i> Tableau de bord</a>
        @if(in_array(auth()->user()->role, ['admin','super_admin'], true))
            <a href="{{ route('etudiants.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('etudiants.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}"><i class="fa-solid fa-user w-4 text-center"></i> Étudiants</a>
            <a href="{{ route('formations.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('formations.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}"><i class="fa-solid fa-graduation-cap w-4 text-center"></i> Diplômes & UE</a>
            <a href="{{ route('examens.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('examens.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}"><i class="fa-solid fa-clipboard-check w-4 text-center"></i> Examens & résultats</a>
        @endif
        @if(in_array(auth()->user()->role, ['admin','super_admin','finance'], true))
            <a href="{{ route('finances.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('finances.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}"><i class="fa-solid fa-dollar-sign w-4 text-center"></i> Finances</a>
        @endif
        @if(in_array(auth()->user()->role, ['admin','super_admin'], true))
            <a href="{{ route('comptes.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('comptes.*') ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}"><i class="fa-solid fa-users-gear w-4 text-center"></i> Comptes & accès</a>
        @endif
        <form method="POST" action="{{ route('logout') }}" class="pt-5">@csrf<button class="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:text-red-600"><i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Déconnexion</button></form>
    </nav>
</aside>
