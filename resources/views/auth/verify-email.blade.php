<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Espace INSEC - Code de Vérification</title>
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
            max-width: 850px;
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
            <p class="mb-4" style="font-size: 14px; opacity: 0.8;">Vérification de sécurité pour votre compte.</p>
            <div class="p-3 border border-light rounded bg-opacity-10 bg-white">
                <span class="small text-uppercase tracking-wider" style="color: #D4AF37; font-weight: bold;">Sécurité OTP</span>
            </div>
        </div>

        
        <div class="col-md-7 right-side text-center">
            <h3 class="fw-bold mb-2" style="color: #1E2761;">Verification Code Validator</h3>
            <p class="text-muted mb-4" style="font-size: 13px;">Entrez le code de vérification envoyé à votre adresse e-mail.</p>

            <form method="GET" action="{{ route('password.reset', ['token' => 'valid_token', 'email' => request('email')]) }}">
                @csrf

                <div class="mb-3 text-start">
                    <label for="verification_code" class="form-label text-secondary" style="font-size: 13px;">Enter Verification Code</label>
                    <input type="text" class="form-control text-center py-2" id="verification_code" name="verification_code" placeholder="----" style="font-size: 20px; letter-spacing: 5px;" required autofocus>
                </div>

                <button type="submit" class="btn btn-custom py-2 fw-semibold mb-3">
                    Verify Code & Continue
                </button>

                <div class="text-center mt-2" style="font-size: 13px;">
                    <a href="{{ route('password.request') }}" class="text-decoration-none text-muted">
                        &larr; Renvoyer le code / Retour
                    </a>
                </div>
            </form>
        </div>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>