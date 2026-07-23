<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Espace INSEC - Nouveau mot de passe</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #f0f2f5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .main-container {
            max-width: 950px;
            width: 100%;
            background: #ffffff;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        .left-side {
            background: linear-gradient(135deg, #1E2761 0%, #293241 100%);
            color: white;
            padding: 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .right-side {
            padding: 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .btn-custom {
            background-color: #1E2761;
            color: white;
            width: 100%;
        }
        .btn-custom:hover {
            background-color: #D4AF37;
            color: white;
        }
    </style>
</head>
<body>

    <div class="main-container row g-0">
        
        
        <div class="col-md-5 left-side text-center">
            <h3 class="fw-bold mb-3">ESPACE INSEC</h3>
            <p class="mb-4" style="font-size: 14px; opacity: 0.8;">Sécurisez votre compte en définissant un nouveau mot de passe.</p>
            <div class="p-3 border border-light rounded bg-opacity-10 bg-white">
                <span class="small text-uppercase tracking-wider" style="color: #D4AF37; font-weight: bold;">Plateforme Officielle</span>
            </div>
        </div>

        
        <div class="col-md-7 right-side">
            <h3 class="fw-bold mb-1" style="color: #1E2761;">Réinitialisation</h3>
            <p class="text-muted mb-3" style="font-size: 13px;">Veuillez entrer votre nouveau mot de passe</p>

            
            @if ($errors->any())
                <div class="alert alert-danger py-2 mb-3" style="font-size: 13px;">
                    <ul class="mb-0 ps-3">
                        @foreach ($errors->all() as $error)
                            <li>
                                @if (str_contains($error, 'at least 8 characters'))
                                    Le mot de passe doit contenir au moins 8 caractères.
                                @elseif (str_contains($error, 'confirmation does not match'))
                                    La confirmation du mot de passe ne correspond pas.
                                @else
                                    {{ $error }}
                                @endif
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('password.update') }}">
                @csrf

                
                <input type="hidden" name="token" value="{{ $request->route('token') }}">

                <div class="mb-3">
                    <label for="email" class="form-label text-secondary" style="font-size: 13px;">Adresse e-mail</label>
                    <input type="email" class="form-control" id="email" name="email" value="{{ $request->email ?? old('email') }}" required autofocus>
                </div>

                <div class="mb-3">
                    <label for="password" class="form-label text-secondary" style="font-size: 13px;">Nouveau mot de passe</label>
                    <input type="password" class="form-control" id="password" name="password" required>
                </div>

                <div class="mb-3">
                    <label for="password_confirmation" class="form-label text-secondary" style="font-size: 13px;">Confirmer le mot de passe</label>
                    <input type="password" class="form-control" id="password_confirmation" name="password_confirmation" required>
                </div>

                <button type="submit" class="btn btn-custom py-2 fw-semibold mb-3">
                    Réinitialiser le mot de passe
                </button>
            </form>
        </div>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>