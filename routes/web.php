<?php

use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AlerteController;
use App\Http\Controllers\CompteController;
use App\Http\Controllers\CandidatureController;
use App\Http\Controllers\CommunicationController;
use App\Http\Controllers\ExcelController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\EnseignantController;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\ExamenController;
use App\Http\Controllers\FormationController;
use App\Http\Controllers\InscriptionController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\PortalController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('auth.login'));
Route::get('/admission', [CandidatureController::class, 'create'])->name('candidatures.create');
Route::post('/admission', [CandidatureController::class, 'store'])->name('candidatures.store');
Route::get('/admission/confirmation/{reference}', [CandidatureController::class, 'confirmation'])->name('candidatures.confirmation');

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [PortalController::class, 'redirect'])->name('dashboard');
    Route::get('/portail/etudiant', [PortalController::class, 'etudiant'])->middleware('role:etudiant')->name('portail.etudiant');
    Route::get('/portail/enseignant', [PortalController::class, 'enseignant'])->middleware('role:enseignant')->name('portail.enseignant');
    Route::get('/alertes', [AlerteController::class, 'index'])->name('alertes.index');
    Route::put('/alertes/tout-lire', [AlerteController::class, 'toutLire'])->name('alertes.tout-lire');
    Route::put('/alertes/{alerte}/lire', [AlerteController::class, 'lire'])->name('alertes.lire');
    Route::put('/alertes/{alerte}/archiver', [AlerteController::class, 'archiver'])->name('alertes.archiver');
});

Route::middleware(['auth', 'role:admin,super_admin'])->group(function () {
    Route::get('/admin/dashboard', [App\Http\Controllers\AdminDashboardController::class, 'index'])->name('admin.dashboard');
    Route::resource('etudiants', EtudiantController::class);
    Route::get('/etudiants/{etudiant}/inscriptions/create', [InscriptionController::class, 'create'])->name('etudiants.inscriptions.create');
    Route::post('/etudiants/{etudiant}/inscriptions', [InscriptionController::class, 'store'])->name('etudiants.inscriptions.store');
    Route::get('/inscriptions/{inscription}/edit', [InscriptionController::class, 'edit'])->name('inscriptions.edit');
    Route::put('/inscriptions/{inscription}', [InscriptionController::class, 'update'])->name('inscriptions.update');
    Route::get('/formations', [FormationController::class, 'index'])->name('formations.index');
    Route::resource('examens', ExamenController::class)->only(['index', 'create', 'store', 'show']);
    Route::put('/examens/{examen}/resultats/{resultat}', [ExamenController::class, 'updateResultat'])->name('examens.resultats.update');
    Route::get('/etudiants/{etudiant}/documents', [DocumentController::class, 'index'])->name('etudiants.documents.index');
    Route::post('/etudiants/{etudiant}/documents', [DocumentController::class, 'store'])->name('etudiants.documents.store');
    Route::get('/documents/{piece}/telecharger', [DocumentController::class, 'download'])->name('documents.download');
    Route::put('/documents/{piece}', [DocumentController::class, 'update'])->name('documents.update');
    Route::get('/pdf/attestations/{inscription}', [PdfController::class, 'attestation'])->name('pdf.attestation');
    Route::get('/pdf/releves/{inscription}', [PdfController::class, 'releve'])->name('pdf.releve');
    Route::get('/pdf/convocations/{examen}/{resultat}', [PdfController::class, 'convocation'])->name('pdf.convocation');
    Route::get('/pdf/recus/{versement}', [PdfController::class, 'recu'])->name('pdf.recu');
    Route::resource('enseignants', EnseignantController::class);
    Route::post('/enseignants/{enseignant}/affectations', [EnseignantController::class, 'storeAffectation'])->name('enseignants.affectations.store');
    Route::delete('/affectations/{affectation}', [EnseignantController::class, 'destroyAffectation'])->name('affectations.destroy');
    Route::get('/comptes', [CompteController::class, 'index'])->name('comptes.index');
    Route::post('/comptes', [CompteController::class, 'store'])->name('comptes.store');
    Route::put('/comptes/{user}/statut', [CompteController::class, 'toggle'])->name('comptes.toggle');
    Route::get('/candidatures', [CandidatureController::class, 'index'])->name('candidatures.index');
    Route::get('/candidatures/{candidature}', [CandidatureController::class, 'show'])->name('candidatures.show');
    Route::put('/candidatures/{candidature}', [CandidatureController::class, 'update'])->name('candidatures.update');
    Route::post('/candidatures/{candidature}/convertir', [CandidatureController::class, 'convertir'])->name('candidatures.convertir');
    Route::get('/communications', [CommunicationController::class, 'index'])->name('communications.index');
    Route::get('/excel', [ExcelController::class, 'index'])->name('excel.index');
    Route::get('/excel/modele', [ExcelController::class, 'modele'])->name('excel.modele');
    Route::get('/excel/etudiants', [ExcelController::class, 'etudiants'])->name('excel.etudiants');
    Route::get('/excel/finances', [ExcelController::class, 'finances'])->name('excel.finances');
    Route::get('/excel/resultats', [ExcelController::class, 'resultats'])->name('excel.resultats');
    Route::post('/excel/importer', [ExcelController::class, 'importer'])->name('excel.importer');
});

Route::middleware(['auth', 'role:admin,super_admin,finance'])->group(function () {
    Route::get('/finances', [App\Http\Controllers\FinanceController::class, 'index'])->name('finances.index');
    Route::put('/finances/inscriptions/{inscription}', [App\Http\Controllers\FinanceController::class, 'updateSituation'])->name('finances.inscriptions.update');
    Route::post('/finances/inscriptions/{inscription}/versements', [App\Http\Controllers\FinanceController::class, 'storeVersement'])->name('finances.versements.store');
    Route::post('/finances/inscriptions/{inscription}/echeances', [App\Http\Controllers\FinanceController::class, 'storeEcheance'])->name('finances.echeances.store');
});

Route::controller(PasswordResetController::class)->group(function () {
    Route::get('forgot-password', 'showForgotForm')->name('password.request');
    Route::post('forgot-password', 'sendCode')->name('password.email');
    Route::get('verify-email-code', 'showVerifyForm')->name('password.code.form');
    Route::post('verify-email-code', 'verifyCode')->name('password.code.verify');
    Route::get('reset-password-custom', 'showResetForm')->name('password.reset.form');
    Route::post('reset-password-custom', 'updatePassword')->name('password.update.custom');
});

require __DIR__.'/auth.php';
