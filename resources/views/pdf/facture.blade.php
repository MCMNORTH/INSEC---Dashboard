<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture {{ $document->numero }}</title>@include('pdf._style')</head><body>
@include('pdf._header')
<table class="doc-head"><tr><td><div class="eyebrow">Frais de formation</div><h1 class="title">Facture</h1></td><td class="number">Facture n°<strong>{{ $document->numero }}</strong>Émise le {{ $document->date_emission->format('d/m/Y') }}</td></tr></table>
<table class="party"><tr><td><div class="label">Facturé à</div><div class="party-name">{{ $inscription->financeur === 'bumex' ? 'BUMEX' : strtoupper($inscription->etudiant->nom).' '.$inscription->etudiant->prenom }}</div>@if($inscription->financeur === 'bumex')Prise en charge interne de {{ $inscription->etudiant->prenom }} {{ $inscription->etudiant->nom }}@else{{ $inscription->etudiant->email ?: 'E-mail non renseigné' }}<br>{{ $inscription->etudiant->telephone ?: 'Téléphone non renseigné' }}@endif</td><td><div class="label">Dossier académique</div><div class="party-name">{{ $inscription->formation->code }}</div>Année {{ $inscription->anneeAcademique->libelle }}<br>{{ $inscription->ues->count() }} UE - Inscription n° {{ $inscription->id }}</td></tr></table>
@php
    $uesFacturees = collect($document->details['ues'] ?? $inscription->ues->map(fn ($ue) => ['code' => $ue->code, 'libelle' => $ue->libelle])->all());
    $prixUe = (int) ($document->details['prix_ue_mru'] ?? $inscription->prix_vente_ue_mru ?? ($uesFacturees->count() ? $document->montant_total / $uesFacturees->count() : $document->montant_total));
@endphp
<table class="grid"><tr><th>Désignation</th><th class="right">Prix</th></tr>
@forelse($uesFacturees as $ue)
<tr><td><span class="ue-code">UE {{ $ue['code'] }}</span>{{ $ue['libelle'] }}</td><td class="right"><strong>{{ number_format($prixUe,0,',',' ') }} MRU</strong></td></tr>
@empty
<tr><td>Frais de formation {{ $inscription->formation->code }}<br><span style="color:#7a8295">Année académique {{ $inscription->anneeAcademique->libelle }}</span></td><td class="right"><strong>{{ number_format($document->montant_total,0,',',' ') }} MRU</strong></td></tr>
@endforelse
</table>
<table class="table-total"><tr><td>Total des UE sélectionnées</td><td class="right">{{ number_format($document->montant_total,0,',',' ') }} MRU</td></tr></table>
<table class="summary"><tr><td>Montant net facturé</td><td class="right">{{ number_format($document->montant_total,0,',',' ') }} MRU</td></tr><tr><td>Déjà réglé</td><td class="right">- {{ number_format($document->montant_paye,0,',',' ') }} MRU</td></tr><tr class="grand"><td>Net à payer</td><td class="right">{{ number_format($document->solde_restant,0,',',' ') }} MRU</td></tr></table>
<div class="legal-note">Cette facture présente la situation du dossier à sa date d'émission. Les paiements ultérieurs feront l'objet d'un reçu distinct. Devise : ouguiya mauritanienne (MRU).</div>
<table class="signature-row"><tr><td><div class="label">Situation</div><div class="party-name">{{ $document->solde_restant > 0 ? 'À régler' : 'Soldée' }}</div></td><td><div class="signature-block"><div class="signature-caption">Cachet et signature de l'INSEC</div><div class="stamp-frame"><img src="{{ public_path('images/cachet-signature-insec-transparent.png') }}" alt="Cachet et signature INSEC"></div></div></td></tr></table>
<div class="footer">INSEC - Institut d'expertise comptable, Nouakchott <span class="right-footer">Document {{ $document->numero }}</span></div>
</body></html>
