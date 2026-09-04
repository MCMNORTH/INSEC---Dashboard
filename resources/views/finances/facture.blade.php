<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture — {{ $etudiant->nom }} {{ $etudiant->prenom }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            padding: 40px;
            color: #1E2761;
        }
        .facture-container {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1E2761;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .header p {
            margin: 5px 0 0;
            color: #888;
            font-size: 13px;
        }
        .infos {
            margin-bottom: 25px;
        }
        .infos p {
            margin: 4px 0;
            font-size: 14px;
        }
        .infos strong {
            display: inline-block;
            width: 160px;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        table th, table td {
            padding: 10px;
            text-align: left;
            font-size: 13px;
            border-bottom: 1px solid #eee;
        }
        table th {
            background-color: #1E2761;
            color: white;
        }
        .recap {
            background-color: #f9f9fb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
        }
        .recap p {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 14px;
        }
        .recap .total {
            font-weight: bold;
            font-size: 16px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }
        .statut {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .statut-solde { background: #d1f7e0; color: #1a7f4e; }
        .statut-partiel { background: #fff3d1; color: #8a6d00; }
        .statut-impaye { background: #ffd6d6; color: #a30000; }

        .print-btn {
            display: block;
            width: 100%;
            padding: 12px;
            background-color: #1E2761;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 20px;
        }
        .print-btn:hover {
            background-color: #D4AF37;
        }

        @media print {
            .print-btn { display: none; }
            body { background: white; padding: 0; }
            .facture-container { box-shadow: none; }
        }
    </style>
</head>
<body>

    <div class="facture-container">

        <div class="header">
            <h1>ESPACE INSEC</h1>
            <p>Facture / Reçu de paiement</p>
        </div>

        <div class="infos">
            <p><strong>Étudiant :</strong> {{ $etudiant->nom }} {{ $etudiant->prenom }}</p>
            <p><strong>Email :</strong> {{ $etudiant->email }}</p>
            <p><strong>Téléphone :</strong> {{ $etudiant->telephone }}</p>
            <p><strong>Formation :</strong> {{ $inscription->formation->libelle ?? '—' }}</p>
            <p><strong>Année académique :</strong> {{ $inscription->anneeAcademique->libelle ?? '—' }}</p>
            <p><strong>Date d'émission :</strong> {{ \Carbon\Carbon::now()->format('d/m/Y') }}</p>
        </div>

        <div class="recap">
            <p><span>Montant dû (année)</span> <span>{{ number_format($inscription->montant_du, 0, ',', ' ') }} MRU</span></p>
            <p><span>Total versé</span> <span>{{ number_format($inscription->total_verse, 0, ',', ' ') }} MRU</span></p>
            <p class="total"><span>Solde restant</span> <span>{{ number_format($inscription->solde_restant, 0, ',', ' ') }} MRU</span></p>
            <p>
                <span>Statut</span>
                <span>
                    @php
                        $statutClasses = [
                            'Soldé' => 'statut-solde',
                            'Partiel' => 'statut-partiel',
                            'Impayé' => 'statut-impaye',
                        ];
                    @endphp
                    <span class="statut {{ $statutClasses[$inscription->statut_paiement] ?? '' }}">
                        {{ $inscription->statut_paiement }}
                    </span>
                </span>
            </p>
        </div>

        <h3 style="font-size: 15px; margin-bottom: 10px;">Historique des versements</h3>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Montant</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($inscription->versements->sortBy('date_versement') as $versement)
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($versement->date_versement)->format('d/m/Y') }}</td>
                        <td>{{ number_format($versement->montant, 0, ',', ' ') }} MRU</td>
                        <td>{{ $versement->statut }}</td>
                    </tr>
                @empty
                    <tr><td colspan="3" style="text-align:center; color:#999;">Aucun versement.</td></tr>
                @endforelse
            </tbody>
        </table>

        <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Télécharger la facture</button>

    </div>

</body>
</html>