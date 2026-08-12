<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\EnseignantController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth'])->name('dashboard');

require __DIR__.'/auth.php';

// Routes protégées par l'authentification
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
});