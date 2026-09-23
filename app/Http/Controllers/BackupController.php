<?php
namespace App\Http\Controllers;
use App\Services\AuditService;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
class BackupController extends Controller
{
    public function index(BackupService $service){return view('backups.index',['sauvegardes'=>$service->lister(),'sqlite'=>config('database.default')==='sqlite']);}
    public function store(BackupService $service){try {$backup=$service->creer();AuditService::manuel('backup','Création de la sauvegarde '.$backup['nom']);return back()->with('success','Sauvegarde chiffrée, conservée et vérifiée.');} catch (\Throwable $e) {return back()->with('error','Sauvegarde non confirmée. Vérifier le client PostgreSQL, les accès au stockage et la clé de sauvegarde.');}}
    public function verifier(string $nom,BackupService $service){$resultat=$service->inspecter($service->resoudre($nom));AuditService::manuel('backup_verify','Contrôle de la sauvegarde '.$nom,null,['intégrité'=>$resultat['integrite']]);return back()->with($resultat['integrite']?'success':'error',$resultat['integrite']?'Intégrité confirmée.':'La sauvegarde est corrompue.');}
    public function download(string $nom,BackupService $service){$path=$service->resoudre($nom);AuditService::manuel('download','Téléchargement de la sauvegarde '.$nom);return response()->download($path,$nom,['Content-Type'=>'application/zip']);}
    public function restore(Request $request,string $nom,BackupService $service){$data=$request->validate(['password'=>'required|string','confirmation'=>'required|in:RESTAURER']);abort_unless(Hash::check($data['password'],$request->user()->password),422,'Mot de passe incorrect.');$service->restaurer($nom);AuditService::manuel('restore','Restauration depuis '.$nom);return redirect()->route('backups.index')->with('success','Restauration terminée. Une sauvegarde de précaution a été créée.');}
}
