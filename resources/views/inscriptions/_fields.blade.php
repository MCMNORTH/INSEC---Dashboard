<div class="grid md:grid-cols-2 gap-4">
    <div>
        <label class="text-sm text-gray-600">Diplôme</label>
        <select id="formation_id" name="formation_id" class="w-full border-gray-300 rounded-lg mt-1" required>
            <option value="">Sélectionner…</option>
            @foreach ($formations as $formation)
                <option value="{{ $formation->id }}" @selected(old('formation_id', $inscription?->id_formation) == $formation->id)>{{ $formation->code }} — {{ $formation->libelle }}</option>
            @endforeach
        </select>
    </div>
    <div>
        <label class="text-sm text-gray-600">Année académique</label>
        <select name="annee_academique_id" class="w-full border-gray-300 rounded-lg mt-1" required>
            @foreach ($annees as $annee)
                <option value="{{ $annee->id }}" @selected(old('annee_academique_id', $inscription?->id_annee_academique) == $annee->id)>{{ $annee->libelle }}</option>
            @endforeach
        </select>
    </div>
    <div>
        <label class="text-sm text-gray-600">Année de parcours</label>
        <select id="annee_parcours" name="annee_parcours" class="w-full border-gray-300 rounded-lg mt-1" required>
            <option value="">Sélectionner…</option>
            @for ($i = 1; $i <= 3; $i++)
                <option value="{{ $i }}" @selected(old('annee_parcours', $inscription?->annee_parcours) == $i)>Année {{ $i }}</option>
            @endfor
        </select>
    </div>
    <div>
        <label class="text-sm text-gray-600">Date d’inscription</label>
        <input type="date" name="date_inscription" value="{{ old('date_inscription', $inscription?->date_inscription?->format('Y-m-d') ?? now()->format('Y-m-d')) }}" class="w-full border-gray-300 rounded-lg mt-1" required>
    </div>
    <div>
        <label class="text-sm text-gray-600">N° d’inscription INTEC <span class="text-gray-400">(facultatif)</span></label>
        <input type="text" name="numero_inscription_intec" value="{{ old('numero_inscription_intec', $inscription?->numero_inscription_intec) }}" class="w-full border-gray-300 rounded-lg mt-1">
    </div>
    <div>
        <label class="text-sm text-gray-600">Payeur</label>
        <select name="financeur" class="w-full border-gray-300 rounded-lg mt-1" required>
            <option value="etudiant" @selected(old('financeur', $inscription?->financeur ?? 'etudiant') === 'etudiant')>Paiement personnel</option>
            <option value="bumex" @selected(old('financeur', $inscription?->financeur) === 'bumex')>Prise en charge BUMEX</option>
        </select>
        <p class="text-xs text-gray-400 mt-1">BUMEX sera facturé au même tarif que l’étudiant.</p>
    </div>
    @if ($showStatus ?? false)
        <div>
            <label class="text-sm text-gray-600">Statut de l’inscription</label>
            <select name="statut" class="w-full border-gray-300 rounded-lg mt-1">
                @foreach (['active' => 'Active', 'terminée' => 'Terminée', 'suspendue' => 'Suspendue', 'annulée' => 'Annulée'] as $value => $label)
                    <option value="{{ $value }}" @selected(old('statut', $inscription?->statut ?? 'active') === $value)>{{ $label }}</option>
                @endforeach
            </select>
        </div>
    @endif
</div>

<div>
    <p class="text-sm font-medium text-gray-700 mb-2">UE suivies</p>
    <div id="ue-list" class="grid md:grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3">
        @foreach ($formations as $formation)
            @foreach ($formation->ues as $ue)
                <label class="ue-option flex gap-2 rounded p-2 hover:bg-gray-50" data-formation="{{ $formation->id }}" data-year="{{ $ue->annee_parcours }}">
                    <input type="checkbox" name="ue_ids[]" value="{{ $ue->id }}" @checked(in_array($ue->id, old('ue_ids', $inscription?->ues->pluck('id')->all() ?? [])))>
                    <span><strong>{{ $ue->code }}</strong> — {{ $ue->libelle }} <span class="text-xs text-gray-500">({{ $ue->credits }} ECTS · {{ number_format(config('insec.tarifs_ue.'.$formation->code.'.vente_mru', 0), 0, ',', ' ') }} MRU)</span></span>
                </label>
            @endforeach
        @endforeach
        <p id="ue-empty" class="text-sm text-gray-500">Choisissez d’abord le diplôme et l’année de parcours.</p>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', () => {
    const formation = document.getElementById('formation_id');
    const year = document.getElementById('annee_parcours');
    const empty = document.getElementById('ue-empty');
    const refresh = () => {
        let visible = 0;
        document.querySelectorAll('.ue-option').forEach((element) => {
            const show = element.dataset.formation === formation.value && element.dataset.year === year.value;
            element.classList.toggle('hidden', !show);
            if (!show) element.querySelector('input').checked = false;
            if (show) visible++;
        });
        empty.classList.toggle('hidden', visible > 0);
    };
    formation.addEventListener('change', refresh);
    year.addEventListener('change', refresh);
    refresh();
});
</script>
