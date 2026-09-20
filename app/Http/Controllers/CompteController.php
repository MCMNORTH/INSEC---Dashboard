<?php

namespace App\Http\Controllers;

use App\Models\Enseignant;
use App\Models\Etudiant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CompteController extends Controller
{
    public function index()
    {
        $comptes = User::with(['etudiant', 'enseignant'])->orderBy('name')->get();
        $etudiants = Etudiant::whereDoesntHave('user')->orderBy('nom')->get();
        $enseignants = Enseignant::whereDoesntHave('user')->orderBy('nom')->get();
        return view('comptes.index', compact('comptes', 'etudiants', 'enseignants'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'], 'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(['admin', 'finance', 'enseignant', 'etudiant'])],
            'etudiant_id' => ['nullable', 'exists:etudiants,id_etudiant', 'unique:users,etudiant_id'],
            'enseignant_id' => ['nullable', 'exists:enseignants,id', 'unique:users,enseignant_id'],
        ]);
        if ($validated['role'] === 'etudiant' && empty($validated['etudiant_id'])) throw ValidationException::withMessages(['etudiant_id' => 'Un dossier étudiant est obligatoire.']);
        if ($validated['role'] === 'enseignant' && empty($validated['enseignant_id'])) throw ValidationException::withMessages(['enseignant_id' => 'Un dossier enseignant est obligatoire.']);
        User::create(['name' => $validated['name'], 'email' => $validated['email'], 'password' => Hash::make($validated['password']), 'role' => $validated['role'],
            'etudiant_id' => $validated['role'] === 'etudiant' ? $validated['etudiant_id'] : null,
            'enseignant_id' => $validated['role'] === 'enseignant' ? $validated['enseignant_id'] : null, 'active' => true]);
        return redirect()->route('comptes.index')->with('status', 'Compte utilisateur créé.');
    }

    public function toggle(User $user)
    {
        abort_if(auth()->id() === $user->id, 422, 'Vous ne pouvez pas désactiver votre propre compte.');
        $user->update(['active' => ! $user->active]);
        return redirect()->route('comptes.index')->with('status', $user->active ? 'Compte activé.' : 'Compte désactivé.');
    }
}
