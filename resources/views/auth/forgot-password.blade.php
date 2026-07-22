<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Espace INSEC - Mot de passe oublié</title>
    
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
            <p class="mb-4" style="font-size: 14px; opacity: 0.8;">Récupérez l'accès à votre compte en toute sécurité.</p>
            <div class="p-3 border border-light rounded bg-opacity-10 bg-white">
                <span class="small text-uppercase tracking-wider" style="color: #D4AF37; font-weight: bold;">Plateforme Officielle</span>
            </div>
        </div>

        
        <div class="col-md-7 right-side">
            <h3 class="fw-bold mb-1" style="color: #1E2761;">Mot de passe oublié ?</h3>
            <p class="text-muted mb-4" style="font-size: 13px;">
                Aucun problème. Indiquez-nous votre adresse e-mail et nous vous enverremo un lien de réinitialisation.
            </p>

            
            @if (session('status'))
                <div class="alert alert-success mb-4" role="alert" style="font-size: 13px;">
                    {{ session('status') }}
                </div>
            @endif

            <form method="POST" action="{{ route('password.email') }}">
                @csrf

                <div class="mb-3">
                    <label for="email" class="form-label text-secondary" style="font-size: 13px;">Adresse e-mail</label>
                    <input type="email" class="form-control" id="email" name="email" value="{{ old('email') }}" required autofocus>
                </div>

                <button type="submit" class="btn btn-custom py-2 fw-semibold mb-3">
                    Envoyer le lien de réinitialisation
                </button>

                <div class="text-center mt-3" style="font-size: 13px;">
                    <a href="{{ route('login') }}" class="text-decoration-none fw-bold" style="color: #1E2761;">
                        &larr; Retour à la connexion
                    </a>
                </div>
            </form>
        </div>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>