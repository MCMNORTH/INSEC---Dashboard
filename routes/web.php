<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\EnseignantController;
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
        return view('enseignants.dashboard');
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
    Route::get('/finances/{etudiant}/facture', [App\Http\Controllers\FinanceController::class, 'facture'])->name('finances.facture');
    Route::put('/finances/versements/{versement}', [App\Http\Controllers\FinanceController::class, 'updateVersement'])->name('finances.versements.update');
    Route::delete('/finances/versements/{versement}', [App\Http\Controllers\FinanceController::class, 'destroyVersement'])->name('finances.versements.destroy');
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