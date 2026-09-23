<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
@php
    $role = auth()->user()->role;
    $isAdmin = in_array($role, ['admin','super_admin'], true);
    $alertesNonLues = auth()->user()->alertes()->where('active', true)->whereNull('lue_at')->whereNull('archivee_at')->count();
    $liens = [
        ['route' => 'dashboard', 'label' => 'Tableau de bord', 'icon' => 'fa-table-cells-large', 'active' => ['dashboard','admin.dashboard']],
    ];
    if ($isAdmin) {
        $liens[] = ['route' => 'etudiants.index', 'label' => 'Étudiants', 'icon' => 'fa-user-graduate', 'active' => ['etudiants.*','candidatures.*','inscriptions.*','documents.*']];
        $liens[] = ['route' => 'academique.index', 'label' => 'Académique', 'icon' => 'fa-graduation-cap', 'active' => ['academique.*','formations.*','enseignants.*','examens.*','affectations.*']];
    }
    if (in_array($role, ['admin','super_admin','finance'], true)) {
        $liens[] = ['route' => 'finances.index', 'label' => 'Finances', 'icon' => 'fa-wallet', 'active' => ['finances.*']];
    }
    if ($isAdmin) {
        $liens[] = ['route' => 'administration.index', 'label' => 'Administration', 'icon' => 'fa-gear', 'active' => ['administration.*','comptes.*','communications.*','excel.*','audit.*','backups.*']];
    }
@endphp

<aside class="sticky top-0 w-64 h-screen bg-white border-r border-gray-200 p-4 flex flex-col shrink-0 overflow-hidden">
    <a href="{{ route('alertes.index') }}" aria-label="Alertes{{ $alertesNonLues ? ' — '.$alertesNonLues.' non lues' : '' }}" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[#1E2761] hover:border-[#D4AF37]">
        <i class="fa-solid fa-bell" aria-hidden="true"></i>
        @if($alertesNonLues)<span class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">{{ $alertesNonLues > 9 ? '9+' : $alertesNonLues }}</span>@endif
    </a>
    <div class="mb-8 text-center">
        <img src="{{ asset('images/logo-insec.png') }}" alt="Logo INSEC" class="w-36 h-20 mx-auto object-contain mb-2">
        <div class="border-t-2 border-[#D4AF37] w-10 mx-auto"></div>
        <p class="text-xs text-gray-400 mt-3">{{ $role === 'finance' ? 'Espace finance' : 'Espace administration' }}</p>
    </div>

    <nav class="space-y-2 flex-1" aria-label="Navigation principale">
        @foreach($liens as $lien)
            @php($actif = request()->routeIs(...$lien['active']))
            <a href="{{ route($lien['route']) }}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium {{ $actif ? 'bg-[#1E2761] text-white' : 'text-gray-600 hover:bg-gray-100' }}">
                <i class="fa-solid {{ $lien['icon'] }} w-5 text-center" aria-hidden="true"></i>{{ $lien['label'] }}
            </a>
        @endforeach
    </nav>

    <div class="border-t pt-4 mt-5">
        <p class="px-3 text-sm font-semibold text-gray-700 truncate">{{ auth()->user()->name }}</p>
        <p class="px-3 text-xs text-gray-400 capitalize">{{ str_replace('_',' ',$role) }}</p>
        <form method="POST" action="{{ route('logout') }}" class="mt-3">@csrf<button class="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:text-red-600"><i class="fa-solid fa-right-from-bracket w-5 text-center"></i> Déconnexion</button></form>
    </div>
</aside>
