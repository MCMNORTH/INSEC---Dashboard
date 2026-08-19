<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\WelcomeUserMail;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create()
    {
        return view('auth.register');
    }

    /**
     * Handle an incoming registration request.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
        ]);

        // Générer un mot de passe temporaire
        $temporaryPassword = Str::random(10);

        // Créer l'utilisateur
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($temporaryPassword),
        ]);

        event(new Registered($user));

        // Envoyer le mot de passe temporaire par e-mail
        Mail::to($user->email)->send(
            new WelcomeUserMail($user, $temporaryPassword)
        );

        // Rediriger vers la page de connexion
        return redirect()->route('login')
            ->with(
                'success',
                'Votre compte a été créé. Le mot de passe a été envoyé à votre adresse e-mail.'
            );
    }
}