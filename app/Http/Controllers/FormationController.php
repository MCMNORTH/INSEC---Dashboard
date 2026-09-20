<?php

namespace App\Http\Controllers;

use App\Models\Formation;

class FormationController extends Controller
{
    public function index()
    {
        $formations = Formation::with('ues')
            ->where('active', true)
            ->orderBy('code')
            ->get();

        return view('formations.index', compact('formations'));
    }
}
