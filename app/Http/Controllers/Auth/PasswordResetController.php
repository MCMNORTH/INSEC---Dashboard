<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class PasswordResetController extends Controller
{
    
    public function sendCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ]);

        $code = rand(100000, 999999);

        DB::table('password_reset_codes')->updateOrInsert(
            ['email' => $request->email],
            [
                'code' => $code,
                'created_at' => Carbon::now()
            ]
        );

        
        logger()->info("Le code de vérification pour " . $request->email . " est : " . $code);

        return redirect()->route('password.code.form', ['email' => $request->email])
                         ->with('status', 'Le code de vérification a été envoyé dans les logs.');
    }

    
    public function showVerifyForm(Request $request)
    {
        $email = $request->query('email');
        return view('auth.verify-email', compact('email'));
    }

    
    public function verifyCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'code' => 'required|numeric'
        ]);

        $record = DB::table('password_reset_codes')
                    ->where('email', $request->email)
                    ->where('code', $request->code)
                    ->first();

        if (!$record) {
            return back()->withErrors(['code' => 'Le code de vérification est invalide.']);
        }

        return redirect()->route('password.reset.form', ['email' => $request->email, 'code' => $request->code]);
    }

    
    public function showResetForm(Request $request)
    {
        $email = $request->query('email');
        $code = $request->query('code');
        return view('auth.reset-password', compact('email', 'code'));
    }

    
    public function updatePassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'code' => 'required',
            'password' => 'required|min:8|confirmed'
        ]);

        $record = DB::table('password_reset_codes')
                    ->where('email', $request->email)
                    ->where('code', $request->code)
                    ->first();

        if (!$record) {
            return back()->withErrors(['email' => 'Requête invalide.']);
        }

        User::where('email', $request->email)->update([
            'password' => Hash::make($request->password)
        ]);

        DB::table('password_reset_codes')->where('email', $request->email)->delete();

        return redirect()->route('login')->with('status', 'Votre mot de passe a été réinitialisé avec succès.');
    }
}