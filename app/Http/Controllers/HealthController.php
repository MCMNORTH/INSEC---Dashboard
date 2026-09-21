<?php

namespace App\Http\Controllers;

use App\Services\ReadinessService;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function live(): JsonResponse
    { return response()->json(['status'=>'ok','application'=>'INSEC Dashboard','timestamp'=>now()->toIso8601String()]); }

    public function ready(ReadinessService $service): JsonResponse
    {
        $resultat=$service->verifier();
        return response()->json(['status'=>$resultat['status'],'checks'=>collect($resultat['checks'])->map(fn($check)=>$check['status']),'checked_at'=>$resultat['checked_at']],$resultat['status']==='failed'?503:200);
    }
}
