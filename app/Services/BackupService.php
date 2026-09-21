<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Throwable;
use ZipArchive;

class BackupService
{
    public function creer(string $motif='Manuelle'): array
    {
        $this->verifierCompatibilite();
        $dir=$this->repertoire();
        $identifiant='insec-'.now()->format('Ymd-His').'-'.strtolower(bin2hex(random_bytes(3)));
        $tempDb=$dir.'/'.$identifiant.'.sqlite.tmp';$archive=$dir.'/'.$identifiant.'.zip';
        try {
            $this->copierBase($tempDb);
            $documents=$this->documents();
            $manifest=['version'=>1,'application'=>config('app.name'),'cree_le'=>now()->toIso8601String(),'motif'=>$motif,'base'=>'database.sqlite','base_sha256'=>hash_file('sha256',$tempDb),'documents'=>$documents];
            $zip=new ZipArchive();if($zip->open($archive,ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true)throw new RuntimeException('Impossible de créer l’archive.');
            $zip->addFile($tempDb,'database.sqlite');
            foreach($documents as $doc)$zip->addFile(storage_path('app/'.$doc['chemin']),'documents/'.$doc['chemin']);
            $zip->addFromString('manifest.json',json_encode($manifest,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$zip->close();
            $controle=$this->inspecter($archive);
            if(!$controle['integrite'])throw new RuntimeException('Le contrôle d’intégrité de la sauvegarde a échoué.');
            return $controle;
        } catch(Throwable $e) {
            File::delete($archive);
            throw $e;
        } finally {
            File::delete($tempDb);
        }
    }

    public function lister(): array
    { $dir=$this->repertoire();return collect(File::files($dir))->filter(fn($f)=>$f->getExtension()==='zip')->map(fn($f)=>$this->inspecter($f->getPathname(),false))->sortByDesc('cree_le')->values()->all(); }

    public function inspecter(string $archive,bool $profond=true): array
    {
        $zip=new ZipArchive();$ok=$zip->open($archive)===true;$manifest=null;$integrite=false;$erreur=null;
        if($ok){$raw=$zip->getFromName('manifest.json');$manifest=$raw?json_decode($raw,true):null;if($manifest&&$zip->locateName('database.sqlite')!==false){$integrite=true;if($profond){$contenu=$zip->getFromName('database.sqlite');$integrite=hash('sha256',$contenu)===$manifest['base_sha256'];foreach($manifest['documents']??[] as $d){$c=$zip->getFromName('documents/'.$d['chemin']);if($c===false||hash('sha256',$c)!==$d['sha256']){$integrite=false;break;}}}}else$erreur='Manifeste ou base absente.';$zip->close();}else$erreur='Archive illisible.';
        return ['nom'=>basename($archive),'chemin'=>$archive,'taille'=>File::exists($archive)?File::size($archive):0,'cree_le'=>$manifest['cree_le']??date(DATE_ATOM,File::exists($archive)?File::lastModified($archive):time()),'motif'=>$manifest['motif']??'Inconnu','documents'=>count($manifest['documents']??[]),'integrite'=>$integrite,'erreur'=>$erreur];
    }

    public function restaurer(string $nom): void
    {
        $this->verifierCompatibilite();
        $archive=$this->resoudre($nom);$controle=$this->inspecter($archive);if(!$controle['integrite'])throw new RuntimeException('Archive invalide ou corrompue.');
        $cible=config('database.connections.sqlite.database');if($cible===':memory:')throw new RuntimeException('La restauration est impossible sur une base SQLite en mémoire.');
        $zip=new ZipArchive();$zip->open($archive);$temp=$this->repertoire().'/restore-'.bin2hex(random_bytes(4)).'.sqlite';File::put($temp,$zip->getFromName('database.sqlite'));
        $documents=[];for($i=0;$i<$zip->numFiles;$i++)if(str_starts_with($zip->getNameIndex($i),'documents/'))$documents[]=$zip->getNameIndex($i);$zip->close();
        try {
            $this->creer('Sauvegarde automatique avant restauration');DB::disconnect('sqlite');File::copy($temp,$cible);
            $zip=new ZipArchive();$zip->open($archive);foreach($documents as $entree){$rel=substr($entree,10);if(!$rel||str_contains($rel,'..'))continue;$contenu=$zip->getFromName($entree);$destination=storage_path('app/'.$rel);File::ensureDirectoryExists(dirname($destination));File::put($destination,$contenu);}$zip->close();
            DB::purge('sqlite');
        } finally { File::delete($temp); }
    }

    public function purgerAnciens(int $jours=30): int
    {
        $supprimes=0;$limite=now()->subDays(max(1,$jours))->getTimestamp();
        foreach(File::files($this->repertoire()) as $f)if($f->getExtension()==='zip'&&$f->getMTime()<$limite){File::delete($f->getPathname());$supprimes++;}
        return $supprimes;
    }

    public function resoudre(string $nom): string
    { if(basename($nom)!==$nom||!preg_match('/^insec-[A-Za-z0-9-]+\.zip$/',$nom))abort(404);$path=$this->repertoire().'/'.$nom;abort_unless(File::exists($path),404);return $path; }
    private function copierBase(string $destination): void
    { $source=config('database.connections.sqlite.database');if($source!==':memory:'&&File::exists($source)){DB::statement('PRAGMA wal_checkpoint(FULL)');File::copy($source,$destination);return;}$quoted=str_replace("'","''",$destination);DB::statement("VACUUM INTO '{$quoted}'"); }
    private function documents(): array
    { $root=storage_path('app/dossiers');if(!File::isDirectory($root))return [];return collect(File::allFiles($root))->map(fn($f)=>['chemin'=>str_replace('\\','/',$f->getRelativePathname()) ? 'dossiers/'.str_replace('\\','/',$f->getRelativePathname()) : '', 'taille'=>$f->getSize(),'sha256'=>hash_file('sha256',$f->getPathname())])->all(); }
    private function repertoire(): string { $dir=storage_path('app/backups');File::ensureDirectoryExists($dir);return $dir; }
    private function verifierCompatibilite(): void
    { if(config('database.default')!=='sqlite')throw new RuntimeException('La sauvegarde intégrée exige SQLite. Configurez un outil natif pour un autre moteur.');if(!class_exists(ZipArchive::class))throw new RuntimeException('L’extension PHP Zip est requise.'); }
}
