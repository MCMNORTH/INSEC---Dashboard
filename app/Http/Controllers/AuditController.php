<?php
namespace App\Http\Controllers;
use App\Models\JournalAudit;
use App\Models\User;
use Illuminate\Http\Request;
class AuditController extends Controller
{
    public function index(Request $request){$logs=JournalAudit::with('user')->when($request->filled('action'),fn($q)=>$q->where('action',$request->action))->when($request->filled('modele'),fn($q)=>$q->where('modele',$request->modele))->when($request->filled('user_id'),fn($q)=>$q->where('user_id',$request->integer('user_id')))->when($request->filled('du'),fn($q)=>$q->whereDate('created_at','>=',$request->du))->when($request->filled('au'),fn($q)=>$q->whereDate('created_at','<=',$request->au))->latest()->paginate(40)->withQueryString();$utilisateurs=User::orderBy('name')->get(['id','name']);$modeles=JournalAudit::whereNotNull('modele')->distinct()->orderBy('modele')->pluck('modele');return view('audit.index',compact('logs','utilisateurs','modeles'));}
}
