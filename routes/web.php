<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\EnseignantController;
use App\Http\Controllers\Auth\PasswordResetController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create some "verify-email-code" etc.
|
*/

Route::get('/', function () {
    return view('auth.login');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth'])->name('dashboard');

Route::middleware(['auth'])->group(function () {
    // Dashboards selon les rôles
    Route::get('/admin/dashboard', function () {
        if (auth()->user()->role !== 'admin') {
            abort(403, "Vous n'êtes pas autorisé à accéder à cette page.");
        }
        return view('admin.dashboard');
    });
    Route::get('/enseignant/dashboard', function () {
        if (auth()->user()->role !== 'enseignant') {
            abort(403, "Vous n'êtes pas autorisé à accéder à cette page.");
        }
        return view('enseignant.dashboard');
    });

    // Gestion des Étudiants (Toutes les fonctions CRUD)
    Route::resource('etudiants', EtudiantController::class);
    // Gestion des Enseignants (Toutes les fonctions CRUD)
    Route::resource('enseignants', EnseignantController::class);
    // Gestion des Affectations des Enseignants
    Route::post('/enseignants/{enseignant}/affectations', [EnseignantController::class, 'storeAffectation'])
        ->name('enseignants.affectations.store');
    Route::delete('/affectations/{affectation}', [EnseignantController::class, 'destroyAffectation'])
        ->name('affectations.destroy');
    Route::get('/finances', [App\Http\Controllers\FinanceController::class, 'index'])->name('finances.index');
    Route::post('/finances/{etudiant}/montant', [App\Http\Controllers\FinanceController::class, 'updateMontant'])->name('finances.montant.update');
    Route::post('/finances/{etudiant}/versements', [App\Http\Controllers\FinanceController::class, 'storeVersement'])->name('finances.versements.store');
});

Route::get('forgot-password', function () {
    return view('auth.forgot-password');
})->name('password.request');

Route::post('forgot-password', [PasswordResetController::class, 'sendCode'])->name('password.email');

Route::get('verify-email-code', [PasswordResetController::class, 'showVerifyForm'])->name('password.code.form');

Route::post('verify-email-code', [PasswordResetController::class, 'verifyCode'])->name('password.code.verify');

Route::get('reset-password-custom', [PasswordResetController::class, 'showResetForm'])->name('password.reset.form');

Route::post('reset-password-custom', [PasswordResetController::class, 'updatePassword'])->name('password.update.custom');

require __DIR__.'/auth.php';