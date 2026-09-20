<?php
namespace App\Http\Controllers;
use App\Models\JournalEmail;
use Illuminate\Http\Request;
class CommunicationController extends Controller
{
    public function index(Request $request){ $journaux=JournalEmail::when($request->filled('statut'),fn($q)=>$q->where('statut',$request->statut))->latest()->paginate(30)->withQueryString(); $stats=JournalEmail::selectRaw('statut,count(*) total')->groupBy('statut')->pluck('total','statut'); return view('communications.index',compact('journaux','stats')); }
}
