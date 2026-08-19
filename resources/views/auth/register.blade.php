<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Espace INSEC - Inscription</title>

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

        <!-- الجانب الأيسر -->
        <div class="col-md-5 left-side text-center">

            <h3 class="fw-bold mb-3">
                ESPACE INSEC
            </h3>

            <p class="mb-4" style="font-size: 14px; opacity: 0.8;">
                Rejoignez notre plateforme et créez votre compte facilement.
            </p>

            <div class="p-3 border border-light rounded bg-opacity-10 bg-white">

                <span
                    class="small text-uppercase tracking-wider"
                    style="color: #D4AF37; font-weight: bold;">
                    Plateforme Officielle
                </span>

            </div>

        </div>


        <!-- الجانب الأيمن -->
        <div class="col-md-7 right-side">

            <h3 class="fw-bold mb-1" style="color: #1E2761;">
                Inscription
            </h3>

            <p class="text-muted mb-3" style="font-size: 13px;">
                Remplissez les informations pour vous inscrire
            </p>


            <!-- رسائل الأخطاء -->
            @if ($errors->any())

                <div
                    class="alert alert-danger py-2 mb-3"
                    style="font-size: 13px;">

                    <ul class="mb-0 ps-3">

                        @foreach ($errors->all() as $error)

                            <li>

                                @if (str_contains($error, 'already been taken'))

                                    L'adresse e-mail est déjà utilisée.

                                @else

                                    {{ $error }}

                                @endif

                            </li>

                        @endforeach

                    </ul>

                </div>

            @endif


            <!-- نموذج التسجيل -->
            <form method="POST" action="{{ route('register') }}">

                @csrf


                <!-- الاسم الكامل -->
                <div class="mb-3">

                    <label
                        for="name"
                        class="form-label text-secondary"
                        style="font-size: 13px;">
                        Nom complet
                    </label>

                    <input
                        type="text"
                        class="form-control"
                        id="name"
                        name="name"
                        value="{{ old('name') }}"
                        required
                        autofocus>

                </div>


                <!-- البريد الإلكتروني -->
                <div class="mb-3">

                    <label
                        for="email"
                        class="form-label text-secondary"
                        style="font-size: 13px;">
                        Adresse e-mail
                    </label>

                    <input
                        type="email"
                        class="form-control"
                        id="email"
                        name="email"
                        value="{{ old('email') }}"
                        required>

                </div>


                <!-- زر التسجيل -->
                <button
                    type="submit"
                    class="btn btn-custom py-2 fw-semibold mb-3">
                    S'inscrire
                </button>


                <!-- الانتقال إلى تسجيل الدخول -->
                <div
                    class="text-center mt-2"
                    style="font-size: 13px;">

                    <span class="text-muted">
                        Vous avez déjà un compte ?
                    </span>

                    <a
                        href="{{ route('login') }}"
                        class="text-decoration-none fw-bold"
                        style="color: #1E2761;">
                        Se connecter
                    </a>

                </div>

            </form>

        </div>

    </div>


    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

</body>
</html>