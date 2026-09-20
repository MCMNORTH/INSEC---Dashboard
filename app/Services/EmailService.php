<?php
namespace App\Services;
use App\Mail\InsecNotificationMail;
use App\Models\JournalEmail;
use Illuminate\Support\Facades\Mail;
use Throwable;
class EmailService
{
    public function envoyer(string $email, ?string $nom, string $type, string $sujet, string $titre, string $message, array $details=[], ?string $url=null, ?string $label=null): JournalEmail
    {
        $journal=JournalEmail::create(['destinataire'=>$email,'nom_destinataire'=>$nom,'type'=>$type,'sujet'=>$sujet]);
        try { Mail::to($email,$nom)->send(new InsecNotificationMail($sujet,$titre,$message,$details,$url,$label)); $journal->update(['statut'=>'Envoyé','envoye_at'=>now()]); }
        catch(Throwable $e){ report($e); $journal->update(['statut'=>'Échec','erreur'=>mb_substr($e->getMessage(),0,2000)]); }
        return $journal;
    }
}
