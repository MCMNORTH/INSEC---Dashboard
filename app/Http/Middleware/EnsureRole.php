<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user() || $request->user()->active === false || ! in_array($request->user()->role, $roles, true)) {
            abort(403, "Vous n'êtes pas autorisé à accéder à cette page.");
        }
        return $next($request);
    }
}
