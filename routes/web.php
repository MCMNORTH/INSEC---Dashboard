<?php

use Illuminate\Support\Facades\Route;
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

Route::middleware(['auth'])->group(function () {
    Route::get('/admin/dashboard', function () {
        if (auth()->user()->role !== 'admin') {
            abort(403, "Vous n'êtes pas autorisé à accéder à cette page.");
        }
        return view('admin.dashboard');
    });

    Route::get('/enseignant/dashboard', function () {
        if (auth()->user()->role !== 'enseignant') {
            abort(403, "Vous n'êtes pas autorisé à accéder à هذه page.");
        }
        return view('enseignant.dashboard');
    });
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