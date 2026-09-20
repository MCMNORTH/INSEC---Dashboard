<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\EnseignantController;
use App\Http\Controllers\FormationController;
use App\Http\Controllers\InscriptionController;
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

Route::get('/dashboard', [App\Http\Controllers\AdminDashboardController::class, 'index'])
    ->middleware(['auth', 'admin'])
    ->name('dashboard');
Route::middleware(['auth', 'admin'])->group(function () {
    // Dashboards selon les rôles
       Route::get('/admin/dashboard', [App\Http\Controllers\AdminDashboardController::class, 'index'])
        ->name('admin.dashboard');
    // Gestion des Étudiants (Toutes les fonctions CRUD)
    Route::resource('etudiants', EtudiantController::class);
    Route::get('/etudiants/{etudiant}/inscriptions/create', [InscriptionController::class, 'create'])->name('etudiants.inscriptions.create');
    Route::post('/etudiants/{etudiant}/inscriptions', [InscriptionController::class, 'store'])->name('etudiants.inscriptions.store');
    Route::get('/inscriptions/{inscription}/edit', [InscriptionController::class, 'edit'])->name('inscriptions.edit');
    Route::put('/inscriptions/{inscription}', [InscriptionController::class, 'update'])->name('inscriptions.update');
    Route::get('/formations', [FormationController::class, 'index'])->name('formations.index');
    // Gestion des Enseignants (Toutes les fonctions CRUD)
    Route::resource('enseignants', EnseignantController::class);
    // Gestion des Affectations des Enseignants
    Route::post('/enseignants/{enseignant}/affectations', [EnseignantController::class, 'storeAffectation'])
        ->name('enseignants.affectations.store');
    Route::delete('/affectations/{affectation}', [EnseignantController::class, 'destroyAffectation'])
        ->name('affectations.destroy');
    Route::get('/finances', [App\Http\Controllers\FinanceController::class, 'index'])->name('finances.index');
    Route::put('/finances/inscriptions/{inscription}', [App\Http\Controllers\FinanceController::class, 'updateSituation'])->name('finances.inscriptions.update');
    Route::post('/finances/inscriptions/{inscription}/versements', [App\Http\Controllers\FinanceController::class, 'storeVersement'])->name('finances.versements.store');
    Route::post('/finances/inscriptions/{inscription}/echeances', [App\Http\Controllers\FinanceController::class, 'storeEcheance'])->name('finances.echeances.store');
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
