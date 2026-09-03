<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">

<aside class="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
 
 <style>
    @keyframes flotter {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
    }
    .logo-flottant {
        animation: flotter 3s ease-in-out infinite;
    }
</style>

<div class="mb-8 text-center">
    <img src="{{ asset('images/logo-insec.png') }}" alt="Logo INSEC" class="logo-flottant w-19 h-20 mx-auto object-contain mb-2">
   <div class="border-t-2 border-[#D4AF37] w-12 mx-auto"></div>
   <br> <p class="text-[#1E2761] font-bold text-xl leading-tight mt-3">INSEC</p>
    <p class="text-xs text-gray-400 mb-7">Espace admin</p>
    
</div>
    <nav class="space-y-1">
       <a href="{{ route('dashboard') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('dashboard') || request()->routeIs('admin.dashboard') ? 'bg-[#1E2761] text-white border-l-4 border-[#D4AF37]' : 'text-gray-600 hover:bg-gray-100' }}">
            <i class="fa-solid fa-table-cells-large w-4 text-center"></i> Tableau de bord
        </a>
        <a href="{{ route('etudiants.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('etudiants.*') ? 'bg-[#1E2761] text-white border-l-4 border-[#D4AF37]' : 'text-gray-600 hover:bg-gray-100' }}">
            <i class="fa-solid fa-user w-4 text-center"></i> Étudiants
        </a>
        {{-- Temporairement masqué à la demande de l'encadrant --}}
        {{-- <a href="{{ route('enseignants.index') }}" ...>Enseignants</a> --}}
        <a href="{{ route('finances.index') }}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium {{ request()->routeIs('finances.*') ? 'bg-[#1E2761] text-white border-l-4 border-[#D4AF37]' : 'text-gray-600 hover:bg-gray-100' }}">
            <i class="fa-solid fa-dollar-sign w-4 text-center"></i> Finances
        </a>
    </nav>
</aside>