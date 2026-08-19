<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Identifiants de connexion</title>
</head>

<body>

    <h2>Bonjour {{ $user->name }},</h2>

    <p>
        Votre compte a été créé avec succès.
    </p>

    <p>
        Vous pouvez vous connecter à votre compte en utilisant les identifiants suivants :
    </p>

    <p>
        <strong>E-mail :</strong>
        {{ $user->email }}
    </p>

    <p>
        <strong>Mot de passe temporaire :</strong>
        {{ $temporaryPassword }}
    </p>

    <p>
        Utilisez ces identifiants sur la page de connexion.
    </p>

    <p>
        Une fois connecté, vous pourrez modifier votre mot de passe
        dans les paramètres de votre profil.
    </p>

</body>
</html>