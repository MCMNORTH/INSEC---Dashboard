<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <main class="flex-1 p-6">
            <div class="mb-6">
                <p class="text-xs font-semibold uppercase tracking-wider text-amber-600">Référentiel officiel INTEC-CNAM</p>
                <h1 class="mt-1 text-2xl font-bold text-[#1E2761]">Diplômes et unités d’enseignement</h1>
                <p class="mt-2 text-sm text-gray-500">Catalogue limité aux deux diplômes ouverts par la convention de l’INSEC.</p>
            </div>

            <div class="space-y-6">
                @foreach ($formations as $formation)
                    <section class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                        <header class="flex flex-wrap items-start justify-between gap-4 bg-[#1E2761] px-6 py-5 text-white">
                            <div>
                                <div class="flex items-center gap-3">
                                    <span class="rounded-lg bg-amber-400 px-3 py-1 text-sm font-black text-[#1E2761]">{{ $formation->code }}</span>
                                    <h2 class="text-lg font-bold">{{ $formation->libelle }}</h2>
                                </div>
                                <p class="mt-2 text-sm text-blue-100">{{ $formation->niveau_diplome }} · {{ $formation->duree_annees }} ans · {{ $formation->credits_total }} ECTS</p>
                            </div>
                            <a href="{{ $formation->source_url }}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-white/30 px-3 py-2 text-xs font-medium hover:bg-white/10">
                                Source officielle ↗
                            </a>
                        </header>

                        <div class="grid gap-5 p-6 {{ $formation->duree_annees === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2' }}">
                            @for ($annee = 1; $annee <= $formation->duree_annees; $annee++)
                                <div>
                                    <h3 class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 text-sm font-bold text-[#1E2761]">
                                        <span>{{ $annee }}{{ $annee === 1 ? 're' : 'e' }} année</span>
                                        <span class="text-xs font-medium text-gray-400">{{ $formation->ues->where('annee_parcours', $annee)->sum('credits') }} ECTS</span>
                                    </h3>
                                    <div class="space-y-2">
                                        @foreach ($formation->ues->where('annee_parcours', $annee) as $ue)
                                            <article class="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p class="text-xs font-bold text-amber-700">{{ $ue->code }}</p>
                                                        <p class="mt-1 text-sm font-medium text-gray-800">{{ $ue->libelle }}</p>
                                                    </div>
                                                    <span class="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-500 shadow-sm">{{ $ue->credits }} ECTS</span>
                                                </div>
                                            </article>
                                        @endforeach
                                    </div>
                                </div>
                            @endfor
                        </div>

                        <footer class="border-t border-gray-100 px-6 py-3 text-xs text-gray-400">
                            Source vérifiée le {{ $formation->source_verifiee_le?->format('d/m/Y') }}
                        </footer>
                    </section>
                @endforeach
            </div>
        </main>
    </div>
</x-app-layout>
