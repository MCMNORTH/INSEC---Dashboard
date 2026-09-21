<x-app-layout>
    <div class="flex min-h-screen bg-gray-100">
        @include('partials.sidebar')

        <div class="flex-1 p-6">
            <h1 class="text-xl font-bold text-[#1E2761] mb-4">Finances</h1>

            @if (session('status'))
                <div class="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4">{{ session('status') }}</div>
            @endif
            @if (session('error'))
                <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{{ session('error') }}</div>
            @endif

            <div class="flex gap-2 mb-4">
                <button onclick="showTab('etudiants')" id="tab-etudiants" class="px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white">
                    Étudiants
                </button>
                <button onclick="showTab('reversement')" id="tab-reversement" class="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border">
                    Synthèse annuelle
                </button>
            </div>

            {{-- Onglet Étudiants --}}
            <div id="panel-etudiants" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div class="lg:col-span-2 bg-white rounded-xl shadow overflow-hidden">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-[#1E2761] text-white">
                                <th class="p-3 text-left">Étudiant</th>
                                <th class="p-3 text-left">Restant</th>
                                <th class="p-3 text-left">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($etudiants as $etudiant)
                                @php $inscription = $etudiant->derniereInscription; @endphp
                                <tr class="border-b hover:bg-gray-50 cursor-pointer {{ $etudiantSelectionne?->id_etudiant === $etudiant->id_etudiant ? 'bg-blue-50' : '' }}"
                                    onclick="window.location='{{ route('finances.index', ['etudiant' => $etudiant->id_etudiant]) }}'">
                                    <td class="p-3 text-gray-900">{{ $etudiant->nom }} {{ $etudiant->prenom }}</td>
                                    <td class="p-3 text-gray-700">{{ number_format($inscription?->solde_restant ?? 0, 0, ',', ' ') }}</td>
                                    <td class="p-3">
                                        @php
                                            $statut = $inscription?->statut_paiement ?? 'Non inscrit';
                                            $styles = ['Soldé' => 'bg-green-100 text-green-700', 'Partiel' => 'bg-amber-100 text-amber-700', 'Impayé' => 'bg-red-100 text-red-700'];
                                        @endphp
                                        <span class="inline-block px-3 py-1 text-xs font-medium rounded-full {{ $styles[$statut] ?? 'bg-gray-100 text-gray-700' }}">
                                            {{ $statut }}
                                        </span>
                                    </td>
                                </tr>
                            @empty
                                <tr><td colspan="3" class="p-6 text-center text-gray-400">Aucun étudiant.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                    <p class="text-xs text-gray-400 p-3">👆 Clique sur un étudiant pour ouvrir son dossier</p>
                </div>

                @if ($etudiantSelectionne)
                    <div class="bg-[#1E2761] text-white rounded-xl shadow p-5">
                        <p class="text-amber-400 text-xs font-bold uppercase tracking-wide">Dossier — {{ $etudiantSelectionne->nom }} {{ $etudiantSelectionne->prenom }}</p>

                        <div class="flex flex-wrap gap-2 mt-3">
                            @foreach ($etudiantSelectionne->inscriptions as $dossier)
                                <a href="{{ route('finances.index', ['etudiant' => $etudiantSelectionne->id_etudiant, 'inscription' => $dossier->id]) }}"
                                   class="text-xs px-2 py-1 rounded {{ $inscriptionSelectionnee?->id === $dossier->id ? 'bg-amber-500 text-white' : 'bg-white/10 text-blue-100' }}">
                                    {{ $dossier->formation?->code }} {{ $dossier->anneeAcademique?->libelle }}
                                </a>
                            @endforeach
                        </div>

                        @if ($inscriptionSelectionnee)
                            <div class="rounded-lg bg-white/10 p-3 mt-4 text-xs">
                                <div class="flex justify-between"><span>Payeur</span><strong>{{ $inscriptionSelectionnee->financeur === 'bumex' ? 'BUMEX' : 'Étudiant' }}</strong></div>
                                <div class="flex justify-between mt-1"><span>UE suivies</span><strong>{{ $inscriptionSelectionnee->ues->count() }}</strong></div>
                                <div class="flex justify-between mt-1"><span>Coût CNAM estimé</span><strong>{{ number_format($inscriptionSelectionnee->cout_cnam_total_eur, 2, ',', ' ') }} €</strong></div>
                            </div>
                            <p class="text-xs text-blue-200 mt-4">Montant brut</p>
                            <p class="text-2xl font-bold">{{ number_format($inscriptionSelectionnee->montant_du, 0, ',', ' ') }} MRU</p>

                            <p class="text-xs text-blue-200 mt-3">Remise · Montant net</p>
                            <p class="text-sm"><span class="text-amber-300">- {{ number_format($inscriptionSelectionnee->montant_remise, 0, ',', ' ') }}</span> · <strong>{{ number_format($inscriptionSelectionnee->montant_net, 0, ',', ' ') }} MRU</strong></p>

                            <p class="text-xs text-blue-200 mt-4">Total versé</p>
                            <p class="text-lg font-bold text-green-400">{{ number_format($inscriptionSelectionnee->total_verse, 0, ',', ' ') }} MRU</p>

                            <p class="text-xs text-blue-200 mt-4">Solde restant (calculé)</p>
                            <p class="text-lg font-bold text-amber-400">{{ number_format($inscriptionSelectionnee->solde_restant, 0, ',', ' ') }} MRU</p>

                            <form method="POST" action="{{ route('pdf.facture', $inscriptionSelectionnee) }}" class="mt-3">
                                @csrf
                                <button type="submit" class="w-full bg-white text-[#1E2761] text-xs font-bold px-3 py-2 rounded-lg border border-white/70">
                                    Télécharger la facture du solde
                                </button>
                            </form>

                            @if ($inscriptionSelectionnee->montant_en_retard > 0)
                                <p class="mt-2 rounded bg-red-500/20 p-2 text-xs text-red-200">En retard : {{ number_format($inscriptionSelectionnee->montant_en_retard, 0, ',', ' ') }} MRU</p>
                            @endif

                            <form method="POST" action="{{ route('finances.inscriptions.update', $inscriptionSelectionnee) }}" class="border-t border-blue-400/30 mt-4 pt-4 space-y-2">
                                @csrf
                                @method('PUT')
                                <div class="flex gap-2">
                                    <div class="flex-1"><label class="text-xs text-blue-200">Montant brut</label><input type="number" name="montant_du" min="0" value="{{ $inscriptionSelectionnee->montant_du }}" class="w-full rounded-lg mt-1 text-gray-900 text-xs" required></div>
                                    <div class="flex-1"><label class="text-xs text-blue-200">Remise</label><input type="number" name="montant_remise" min="0" value="{{ $inscriptionSelectionnee->montant_remise }}" class="w-full rounded-lg mt-1 text-gray-900 text-xs" required></div>
                                </div>
                                <select name="financeur" class="w-full rounded-lg text-gray-900 text-xs"><option value="etudiant" @selected($inscriptionSelectionnee->financeur==='etudiant')>Paiement personnel</option><option value="bumex" @selected($inscriptionSelectionnee->financeur==='bumex')>Prise en charge BUMEX</option></select>
                                <div class="grid grid-cols-2 gap-2"><input name="reference_facture_bumex" value="{{ $inscriptionSelectionnee->reference_facture_bumex }}" placeholder="Réf. facture BUMEX" class="rounded-lg text-gray-900 text-xs"><input type="date" name="facture_bumex_emise_le" value="{{ $inscriptionSelectionnee->facture_bumex_emise_le?->format('Y-m-d') }}" class="rounded-lg text-gray-900 text-xs"></div>
                                <textarea name="note_financiere" placeholder="Note financière interne" class="w-full rounded-lg text-gray-900 text-xs">{{ $inscriptionSelectionnee->note_financiere }}</textarea>
                                <button type="submit" class="w-full bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg">Mettre à jour</button>
                            </form>

                            <div class="border-t border-blue-400/30 mt-4 pt-4">
                                <p class="text-xs text-blue-200 mb-2">Échéancier</p>
                                @forelse($inscriptionSelectionnee->echeances as $echeance)
                                    <div class="flex justify-between text-xs bg-white/10 rounded px-2 py-1 mb-1"><span>{{ $echeance->libelle }} · {{ $echeance->date_echeance->format('d/m/Y') }}</span><strong>{{ number_format($echeance->montant,0,',',' ') }}</strong></div>
                                @empty <p class="text-xs text-blue-200">Aucune échéance.</p> @endforelse
                                <form method="POST" action="{{ route('finances.echeances.store', $inscriptionSelectionnee) }}" class="grid grid-cols-2 gap-2 mt-2">@csrf
                                    <input name="libelle" placeholder="Ex. 1re tranche" class="rounded text-gray-900 text-xs" required><input type="number" name="montant" min="1" placeholder="Montant" class="rounded text-gray-900 text-xs" required><input type="date" name="date_echeance" class="rounded text-gray-900 text-xs" required><button class="bg-white/10 rounded text-xs">+ Échéance</button>
                                </form>
                            </div>

                            <div class="border-t border-blue-400/30 mt-4 pt-4">
                                <p class="text-xs text-blue-200 mb-2">Derniers versements</p>
                                <div class="space-y-2 mb-4">
                                    @forelse ($inscriptionSelectionnee->versements->sortByDesc('date_versement') as $versement)
                                        <div class="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 text-xs">
                                            <span>{{ $versement->date_versement->format('d/m/Y') }}</span>
                                            <span>{{ number_format($versement->montant, 0, ',', ' ') }}</span>
                                            <span class="{{ $versement->statut === 'Validée' ? 'text-green-400' : 'text-amber-400' }}">{{ $versement->statut }}</span>
                                        </div>
                                        <p class="text-[10px] text-blue-200 px-2">{{ $versement->numero_recu ?? 'Sans reçu' }} · {{ $versement->mode_paiement }} {{ $versement->reference ? '· '.$versement->reference : '' }}</p>
                                        @if ($versement->statut === 'Validée')
                                            <a href="{{ route('pdf.recu', $versement) }}" class="inline-block ml-2 text-[10px] font-bold text-amber-300 underline">Télécharger le reçu</a>
                                        @endif
                                    @empty
                                        <p class="text-xs text-blue-200">Aucun versement.</p>
                                    @endforelse
                                </div>

                                <form method="POST" action="{{ route('finances.versements.store', $inscriptionSelectionnee) }}" class="space-y-2">
                                    @csrf
                                    <p class="text-xs text-blue-200">Ajouter un versement</p>
                                    <div class="flex gap-2">
                                        <input type="number" name="montant" min="1" placeholder="Montant" class="w-1/2 rounded-lg text-gray-900 text-xs" required>
                                        <input type="date" name="date_versement" class="w-1/2 rounded-lg text-gray-900 text-xs" required>
                                    </div>
                                    <select name="statut" class="w-full rounded-lg text-gray-900 text-xs" required>
                                        <option value="Validée">Validée</option>
                                        <option value="En attente">En attente</option>
                                    </select>
                                    <div class="flex gap-2"><select name="mode_paiement" class="w-1/2 rounded-lg text-gray-900 text-xs">@foreach(['Espèces','Virement','Chèque','Carte','Mobile Money'] as $mode)<option>{{ $mode }}</option>@endforeach</select><input name="reference" placeholder="Référence (facultatif)" class="w-1/2 rounded-lg text-gray-900 text-xs"></div>
                                    <textarea name="note" placeholder="Note (facultatif)" class="w-full rounded-lg text-gray-900 text-xs"></textarea>
                                    <button type="submit" class="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg">
                                        + Ajouter le versement
                                    </button>
                                </form>
                            </div>
                        @else
                            <p class="text-sm text-blue-200 mt-4">
                                Cet étudiant n'a pas encore de formation/année assignée.
                                <a href="{{ route('etudiants.edit', $etudiantSelectionne) }}" class="underline text-amber-400">Compléter sa fiche</a>
                            </p>
                        @endif
                    </div>
                @endif
            </div>

            {{-- Synthèse des frais facturés et encaissés ; les reversements INTEC seront suivis séparément. --}}
            <div id="panel-reversement" class="hidden">
                <form method="GET" action="{{ route('finances.index') }}" class="mb-4 flex items-center gap-3">
                    <input type="hidden" name="tab" value="reversement">
                    <label class="text-sm text-gray-600">Année académique :</label>
                    <select name="annee_reversement" onchange="this.form.submit()" class="border-gray-300 rounded-lg text-sm">
                        @foreach ($annees as $annee)
                            <option value="{{ $annee->id }}" @selected($anneeSelectionneeId == $annee->id)>{{ $annee->libelle }}</option>
                        @endforeach
                    </select>
                </form>

                <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Étudiants concernés</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ $carteReversement->nb_etudiants ?? 0 }}</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Frais nets facturés</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ number_format(($carteReversement->montant_du ?? 0) / 1000000, 1) }} M MRU</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Encaissé auprès des étudiants</p>
                        <p class="text-xl font-bold text-green-600">{{ number_format(($carteReversement->reverse ?? 0) / 1000000, 1) }} M MRU</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Prise en charge BUMEX</p>
                        <p class="text-xl font-bold text-amber-600">{{ number_format($carteReversement->prise_en_charge_bumex ?? 0, 0, ',', ' ') }} MRU</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Créances restantes</p>
                        <p class="text-xl font-bold text-red-600">{{ number_format($carteReversement->creances ?? 0, 0, ',', ' ') }} MRU</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">UE facturables au CNAM</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ $carteReversement->nb_ue_dgc ?? 0 }} DGC · {{ $carteReversement->nb_ue_dsgc ?? 0 }} DSGC</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Dette CNAM prévisionnelle</p>
                        <p class="text-xl font-bold text-[#1E2761]">{{ number_format($carteReversement->cout_cnam_eur ?? 0, 2, ',', ' ') }} €</p>
                        <p class="text-xs text-gray-500">{{ ($carteReversement->facture_cnam?->taux_change_previsionnel ?? null) ? number_format($carteReversement->cout_cnam_mru, 0, ',', ' ').' MRU' : 'Taux EUR/MRU à renseigner' }}</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Marge prévisionnelle</p>
                        <p class="text-xl font-bold text-green-600">{{ $carteReversement->marge_previsionnelle !== null ? number_format($carteReversement->marge_previsionnelle, 0, ',', ' ').' MRU' : '—' }}</p>
                    </div>
                    <div class="bg-white rounded-xl shadow p-4">
                        <p class="text-xs text-gray-500">Manque pour régler le CNAM</p>
                        <p class="text-xl font-bold text-red-600">{{ $carteReversement->besoin_cnam !== null ? number_format($carteReversement->besoin_cnam, 0, ',', ' ').' MRU' : '—' }}</p>
                    </div>
                </div>

                <form method="POST" action="{{ route('finances.cnam.update', $anneeSelectionneeId) }}" class="bg-white rounded-xl shadow p-5 mb-4">@csrf @method('PUT')
                    <div class="flex items-center justify-between gap-3 mb-4"><div><h2 class="font-bold text-[#1E2761]">Facture annuelle CNAM</h2><p class="text-xs text-gray-500">Prévision continue, puis rapprochement avec la facture reçue vers février.</p></div><select name="statut" class="rounded-lg border-gray-300 text-sm">@foreach(['Prévisionnelle','Reçue','À payer','Payée'] as $statut)<option @selected(($carteReversement->facture_cnam?->statut ?? 'Prévisionnelle')===$statut)>{{ $statut }}</option>@endforeach</select></div>
                    <div class="grid md:grid-cols-3 gap-3 text-sm">
                        <label>Taux prévisionnel EUR/MRU<input type="number" step="0.0001" min="0" name="taux_change_previsionnel" value="{{ $carteReversement->facture_cnam?->taux_change_previsionnel }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Montant réel (€)<input type="number" step="0.01" min="0" name="montant_reel_eur" value="{{ $carteReversement->facture_cnam?->montant_reel_eur }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Taux réel de règlement<input type="number" step="0.0001" min="0" name="taux_change_reglement" value="{{ $carteReversement->facture_cnam?->taux_change_reglement }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Date de réception<input type="date" name="date_reception" value="{{ $carteReversement->facture_cnam?->date_reception?->format('Y-m-d') }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Échéance<input type="date" name="date_echeance" value="{{ $carteReversement->facture_cnam?->date_echeance?->format('Y-m-d') }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Date de règlement<input type="date" name="date_reglement" value="{{ $carteReversement->facture_cnam?->date_reglement?->format('Y-m-d') }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label>Référence<input name="reference" value="{{ $carteReversement->facture_cnam?->reference }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                        <label class="md:col-span-2">Note<input name="note" value="{{ $carteReversement->facture_cnam?->note }}" class="w-full mt-1 rounded-lg border-gray-300"></label>
                    </div>
                    <button class="mt-4 bg-[#1E2761] text-white px-4 py-2 rounded-lg text-sm font-semibold">Enregistrer la prévision CNAM</button>
                </form>

                <table class="w-full text-sm border-collapse rounded-lg overflow-hidden bg-white shadow">
                    <thead>
                        <tr class="bg-[#1E2761] text-white">
                            <th class="p-3 text-left">Année académique</th>
                            <th class="p-3 text-left">Étudiants</th>
                            <th class="p-3 text-left">Montant dû</th>
                            <th class="p-3 text-left">Encaissé</th>
                            <th class="p-3 text-left">CNAM</th><th class="p-3 text-left">Marge</th><th class="p-3 text-left">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        @php $styles = ['Soldé' => 'bg-green-100 text-green-700', 'Partiel' => 'bg-amber-100 text-amber-700', 'Impayé' => 'bg-red-100 text-red-700']; @endphp
                        @forelse ($anneesAvecDonnees as $annee)
                            <tr class="border-b">
                                <td class="p-3">{{ $annee->libelle }}</td>
                                <td class="p-3">{{ $annee->nb_etudiants }}</td>
                                <td class="p-3">{{ number_format($annee->montant_du, 0, ',', ' ') }}</td>
                                <td class="p-3">{{ number_format($annee->reverse, 0, ',', ' ') }}</td>
                                <td class="p-3">{{ number_format($annee->cout_cnam_eur, 2, ',', ' ') }} €</td>
                                <td class="p-3">{{ $annee->marge_previsionnelle !== null ? number_format($annee->marge_previsionnelle, 0, ',', ' ') : '—' }}</td>
                                <td class="p-3">
                                    <span class="inline-block px-3 py-1 text-xs font-medium rounded-full {{ $styles[$annee->statut] }}">
                                        {{ $annee->statut }}
                                    </span>
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="p-6 text-center text-gray-400">Aucune donnée.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        function showTab(tab) {
            document.getElementById('panel-etudiants').classList.toggle('hidden', tab !== 'etudiants');
            document.getElementById('panel-reversement').classList.toggle('hidden', tab !== 'reversement');
            document.getElementById('tab-etudiants').className = tab === 'etudiants'
                ? 'px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white'
                : 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border';
            document.getElementById('tab-reversement').className = tab === 'reversement'
                ? 'px-4 py-2 rounded-lg text-sm font-medium bg-[#1E2761] text-white'
                : 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 border';
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'reversement') {
            showTab('reversement');
        }
    </script>
</x-app-layout>
