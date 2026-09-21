<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class NavigationController extends Controller
{
    public function academique(): View
    { return view('navigation.academique'); }

    public function administration(): View
    { return view('navigation.administration'); }
}
