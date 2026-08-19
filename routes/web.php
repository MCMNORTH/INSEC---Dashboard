<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\PasswordResetController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Page d'accueil (Login)
Route::get('/', function () {
    return view('auth.login');
});

// Espace Administrateur Protégé
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', function () {
        return view('admin.dashboard');
    })->name('dashboard');
});

// Réinitialisation de mot de passe (Custom)
Route::controller(PasswordResetController::class)->group(function () {
    Route::get('forgot-password', 'showForgotForm')->name('password.request');
    Route::post('forgot-password', 'sendCode')->name('password.email');
    
    Route::get('verify-email-code', 'showVerifyForm')->name('password.code.form');
    Route::post('verify-email-code', 'verifyCode')->name('password.code.verify');
    
    Route::get('reset-password-custom', 'showResetForm')->name('password.reset.form');
    Route::post('reset-password-custom', 'updatePassword')->name('password.update.custom');
});

require __DIR__.'/auth.php';