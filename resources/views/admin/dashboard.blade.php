<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">

           <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
    <h1 class="text-xl font-bold text-[#1E2761]">Bonjour, Administrateur</h1>
    <div class="flex items-center gap-2">
        <div class="relative" x-data="{ open: false }">
                        <button @click="open = !open" class="flex items-center gap-2 bg-white border border-[#D4AF37] rounded-full pl-1 pr-3 py-1 hover:bg-gray-50">
                            <span class="w-7 h-7 rounded-full bg-[#1E2761] text-white flex items-center justify-center text-xs font-bold">
                                {{ strtoupper(substr(auth()->user()->name, 0, 1)) }}
                            </span>
                            <span class="text-sm font-medium text-gray-700">Administrateur</span>
                            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                        </button>
                        <div x-show="open" @click.away="open = false" x-cloak class="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                            <form method="POST" action="{{ route('logout') }}">
                                @csrf
                                <button type="submit" class="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                    Se déconnecter
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

<!-- Cartes de statistiques -->

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
    <!-- Étudiants total -->
    <div class="bg-amber-100/60 rounded-xl shadow-sm p-4 border-t-4 border-[#D4AF37]">
        <i class="fa-solid fa-users text-[#1E2761] text-xl mb-3 block"></i>
        <p class="text-2xl font-bold text-[#1E2761] whitespace-nowrap">{{ $totalEtudiants }}</p>
        <p class="text-sm text-gray-500">Étudiants total</p>
    </div>

    <!-- Étudiants actifs -->
    <div class="bg-emerald-50 rounded-xl shadow-sm p-4 border-t-4 border-[#D4AF37]">
        <i class="fa-solid fa-check text-[#1E2761] text-xl mb-3 block"></i>
        <p class="text-2xl font-bold text-[#1E2761] whitespace-nowrap">{{ $etudiantsActifs }}</p>
        <p class="text-sm text-gray-500">Étudiants actifs</p>
    </div>

    <!-- Encaissés -->
    <div class="bg-amber-50 rounded-xl shadow-sm p-4 border-t-4 border-[#D4AF37]">
        <i class="fa-solid fa-credit-card text-[#1E2761] text-xl mb-3 block"></i>
        <p class="text-2xl font-bold text-[#1E2761] whitespace-nowrap">{{ $encaissesFormatted }}</p>
        <p class="text-sm text-gray-500">Encaissés (MRU)</p>
    </div>

    <!-- En attente -->
    <div class="bg-orange-50 rounded-xl shadow-sm p-4 border-t-4 border-[#D4AF37]">
        <i class="fa-solid fa-clock text-[#1E2761] text-xl mb-3 block"></i>
        <p class="text-2xl font-bold text-[#1E2761] whitespace-nowrap">{{ $enAttenteFormatted }}</p>
        <p class="text-sm text-gray-500">En attente (MRU)</p>
    </div>

    <!-- Enseignants -->
    <div class="bg-purple-100/60 rounded-xl shadow-sm p-4 border-t-4 border-[#D4AF37]">
        <i class="fa-solid fa-display text-[#1E2761] text-xl mb-3 block"></i>
        <p class="text-2xl font-bold text-[#1E2761] whitespace-nowrap">{{ $totalEnseignants }}</p>
        <p class="text-sm text-gray-500">Enseignants</p>
    </div>
</div><!-- Graphiques -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <!-- Graphique Paiements (Ajusté pour centrer le canvas) -->
    <div class="lg:col-span-2 bg-white rounded-xl shadow p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-bold text-gray-600">Paiements encaissés par mois</h2>
            <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                <button id="btn6mois" onclick="afficherPeriode(6)" class="px-3 py-1.5 bg-[#1E2761] text-white">6 mois</button>
                <button id="btn12mois" onclick="afficherPeriode(12)" class="px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50">12 mois</button>
            </div>
        </div>
        
        <!-- Conteneur flex-1 avec my-auto pour centrer verticalement le canvas -->
        <div class="flex-1 flex items-center justify-center my-auto">
            <canvas id="paiementsChart" height="90"></canvas>
        </div>
    </div>

    <!-- Graphique Répartition des statuts -->
    <div class="bg-white rounded-xl shadow p-5 flex flex-col justify-between">
        <h2 class="text-sm font-bold text-gray-600 mb-3">Répartition des statuts</h2>
        <div>
            <canvas id="statutsChart" height="180"></canvas>
        </div>
        <div class="flex justify-center gap-3 mt-3 text-xs font-semibold">
            <span class="text-emerald-600">● Actif</span>
            <span class="text-amber-600">● Suspendu</span>
            <span class="text-red-600">● Abandon</span>
        </div>
    </div>
</div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script>
        const moisLabels12 = {!! json_encode($moisLabels12) !!};
        const paiements12 = {!! json_encode($paiements12) !!};

        const ctx = document.getElementById('paiementsChart');
        const paiementsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: moisLabels12.slice(0, 6),
                datasets: [{
                    label: 'Encaissés (MRU)',
                    data: paiements12.slice(0, 6),
                    backgroundColor: '#1E2761',
                    borderRadius: 6,
                    maxBarThickness: 40,
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        function afficherPeriode(nbMois) {
            paiementsChart.data.labels = moisLabels12.slice(0, nbMois);
            paiementsChart.data.datasets[0].data = paiements12.slice(0, nbMois);
            paiementsChart.update();

            document.getElementById('btn6mois').className = nbMois === 6
                ? 'px-3 py-1.5 bg-[#1E2761] text-white'
                : 'px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50';
            document.getElementById('btn12mois').className = nbMois === 12
                ? 'px-3 py-1.5 bg-[#1E2761] text-white'
                : 'px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50';
        }

        new Chart(document.getElementById('statutsChart'), {
            type: 'doughnut',
            data: {
                labels: ['Actif', 'Suspendu', 'Abandon'],
                datasets: [{
                    data: [{{ $statutActif }}, {{ $statutSuspendu }}, {{ $statutAbandon }}],
                    backgroundColor: ['#65a30d', '#d97706', '#dc2626'],
                    borderWidth: 0,
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                cutout: '70%'
            }
        });
    </script>
</x-app-layout>