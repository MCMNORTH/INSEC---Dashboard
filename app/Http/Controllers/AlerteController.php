<?php

namespace App\Http\Controllers;

use App\Models\Alerte;
use App\Services\AlertService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AlerteController extends Controller
{
    public function index(Request $request, AlertService $service): View
    {
        $service->synchroniser($request->user());
        $alertes = $request->user()->alertes()->where('active', true)->whereNull('archivee_at')->latest()->paginate(20);
        return view('alertes.index', compact('alertes'));
    }

    public function lire(Request $request, Alerte $alerte): RedirectResponse
    {
        $this->autoriser($request, $alerte);
        $alerte->update(['lue_at' => now()]);
        return $alerte->lien ? redirect($alerte->lien) : back();
    }

    public function toutLire(Request $request): RedirectResponse
    {
        $request->user()->alertes()->where('active', true)->whereNull('archivee_at')->update(['lue_at' => now()]);
        return back()->with('success', 'Toutes les alertes ont été marquées comme lues.');
    }

    public function archiver(Request $request, Alerte $alerte): RedirectResponse
    {
        $this->autoriser($request, $alerte);
        $alerte->update(['archivee_at' => now(), 'lue_at' => $alerte->lue_at ?: now()]);
        return back()->with('success', 'Alerte archivée.');
    }

    private function autoriser(Request $request, Alerte $alerte): void
    {
        abort_unless($alerte->user_id === $request->user()->id, 403);
    }
}
