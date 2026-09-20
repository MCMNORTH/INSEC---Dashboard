<?php
namespace App\Mail;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
class InsecNotificationMail extends Mailable
{
    use Queueable, SerializesModels;
    public function __construct(public string $objet, public string $titre, public string $message, public array $details=[], public ?string $actionUrl=null, public ?string $actionLabel=null) {}
    public function build(){ return $this->subject($this->objet)->view('emails.notification'); }
}
