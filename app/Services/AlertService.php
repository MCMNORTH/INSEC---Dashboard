<?php

namespace App\Services;

use App\Models\Alerte;
use App\Models\Examen;
use App\Models\Inscription;
use App\Models\PieceAdministrative;
use App\Models\ResultatExamen;
use App\Models\User;

class AlertService
{
    public function synchroniser(User $user): void
    {
        $user->alertes()->whereNull('archivee_at')->update(['active' => false]);

        if (in_array($user->role, ['admin', 'super_admin', 'finance'], true)) {
            $this->alertesFinancieres($user);
        }
        if (in_array($user->role, ['admin', 'super_admin'], true)) {
            $this->alertesAdministratives($user);
            $this->alertesExamensGlobaux($user);
        }
        if ($user->role === 'etudiant' && $user->etudiant_id) {
            $this->alertesEtudiant($user);
        }
        if ($user->role === 'enseignant' && $user->enseignant_id) {
            $this->alertesEnseignant($user);
        }
    }

    private function alertesFinancieres(User $user): void
    {
        Inscription::with(['etudiant', 'echeances', 'versements'])->where('statut', 'active')->get()
            ->filter(fn ($inscription) => $inscription->montant_en_retard > 0)
            ->each(fn ($inscription) => $this->enregistrer($user, [
                'cle' => 'retard-paiement-'.$inscription->id,
                'type' => 'finance', 'niveau' => 'danger', 'titre' => 'Paiement en retard',
                'message' => $inscription->etudiant->prenom.' '.$inscription->etudiant->nom.' présente un retard de '.number_format($inscription->montant_en_retard, 0, ',', ' ').' MRU.',
                'lien' => route('finances.index'),
            ]));
    }

    private function alertesAdministratives(User $user): void
    {
        PieceAdministrative::with('etudiant')->whereIn('statut', ['À vérifier', 'Rejeté'])->get()->each(function ($piece) use ($user) {
            $this->enregistrer($user, [
                'cle' => 'document-'.$piece->id.'-'.$piece->statut,
                'type' => 'document', 'niveau' => $piece->statut === 'Rejeté' ? 'danger' : 'warning',
                'titre' => $piece->statut === 'Rejeté' ? 'Document rejeté à régulariser' : 'Document à vérifier',
                'message' => $piece->type.' — '.$piece->etudiant->prenom.' '.$piece->etudiant->nom.'.',
                'lien' => route('etudiants.documents.index', $piece->etudiant),
            ]);
        });
    }

    private function alertesExamensGlobaux(User $user): void
    {
        Examen::with('ue')->where('statut', 'Planifié')->whereBetween('date_examen', [now(), now()->addDays(7)])->get()->each(fn ($examen) =>
            $this->alerteExamen($user, $examen, route('examens.show', $examen))
        );
    }

    private function alertesEtudiant(User $user): void
    {
        $inscriptions = Inscription::with(['echeances', 'versements'])->where('id_etudiant', $user->etudiant_id)->get();
        $inscriptions->filter(fn ($i) => $i->montant_en_retard > 0)->each(fn ($i) => $this->enregistrer($user, [
            'cle' => 'mon-retard-'.$i->id, 'type' => 'finance', 'niveau' => 'danger', 'titre' => 'Échéance de paiement dépassée',
            'message' => 'Votre montant en retard est de '.number_format($i->montant_en_retard, 0, ',', ' ').' MRU.',
            'lien' => route('portail.etudiant'),
        ]));

        $ids = $inscriptions->pluck('id');
        ResultatExamen::with('examen.ue')->whereIn('inscription_id', $ids)->get()->each(function ($resultat) use ($user) {
            if ($resultat->examen?->statut === 'Planifié' && $resultat->examen->date_examen->between(now(), now()->addDays(14))) {
                $this->alerteExamen($user, $resultat->examen, route('portail.etudiant'));
            }
            if ($resultat->note !== null) {
                $this->enregistrer($user, [
                    'cle' => 'resultat-'.$resultat->id.'-'.$resultat->updated_at?->timestamp,
                    'type' => 'resultat', 'niveau' => $resultat->valide ? 'success' : 'warning', 'titre' => 'Résultat publié',
                    'message' => $resultat->examen->ue->code.' : '.$resultat->note.'/'.$resultat->examen->note_sur.'.',
                    'lien' => route('portail.etudiant'),
                ]);
            }
        });

        PieceAdministrative::where('etudiant_id', $user->etudiant_id)->where('statut', 'Rejeté')->get()->each(fn ($piece) => $this->enregistrer($user, [
            'cle' => 'mon-document-'.$piece->id, 'type' => 'document', 'niveau' => 'danger', 'titre' => 'Document à remplacer',
            'message' => $piece->type.($piece->note ? ' : '.$piece->note : ' a été rejeté.'), 'lien' => route('portail.etudiant'),
        ]));
    }

    private function alertesEnseignant(User $user): void
    {
        $ueIds = $user->enseignant->affectations()->pluck('ue_id');
        Examen::with('ue')->whereIn('ue_id', $ueIds)->where('statut', 'Planifié')->whereBetween('date_examen', [now(), now()->addDays(14)])->get()
            ->each(fn ($examen) => $this->alerteExamen($user, $examen, route('portail.enseignant')));
    }

    private function alerteExamen(User $user, Examen $examen, string $lien): void
    {
        $this->enregistrer($user, [
            'cle' => 'examen-'.$examen->id, 'type' => 'examen', 'niveau' => 'info', 'titre' => 'Examen à venir',
            'message' => $examen->ue->code.' — '.$examen->date_examen->format('d/m/Y à H:i').($examen->salle ? ' ('.$examen->salle.')' : '').'.',
            'lien' => $lien,
        ]);
    }

    private function enregistrer(User $user, array $donnees): void
    {
        Alerte::updateOrCreate(['user_id' => $user->id, 'cle' => $donnees['cle']], $donnees + ['active' => true]);
    }
}
