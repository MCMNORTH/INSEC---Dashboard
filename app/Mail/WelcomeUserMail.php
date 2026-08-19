<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class WelcomeUserMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $temporaryPassword;

    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(User $user, $temporaryPassword)
    {
        $this->user = $user;
        $this->temporaryPassword = $temporaryPassword;
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        return $this->subject('Vos identifiants de connexion')
                    ->view('emails.welcome-user');
    }
}