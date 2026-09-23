<?php
namespace App\Http\Controllers;

use App\Models\AnneeAcademique;
use App\Models\Candidature;
use App\Models\Etudiant;
use App\Models\Formation;
use App\Models\Inscription;
use App\Models\Ue;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CandidatureController extends Controller
{
    public function __construct(private EmailService $emails) {}
    public function create()
    {
        return view('candidatures.create', ['formations'=>Formation::where('active',true)->orderBy('code')->get(), 'annees'=>AnneeAcademique::disponibles()->orderByDesc('libelle')->get()]);
    }

    public function store(Request $request)
    {
        $data=$request->validate(['nom'=>'required|string|max:100','prenom'=>'required|string|max:100','email'=>'required|email|max:255','telephone'=>'required|string|max:40','date_naissance'=>'nullable|date|before:today','dernier_diplome'=>'required|string|max:150','formation_id'=>'required|exists:formations,id','annee_academique_id'=>['required','exists:annees_academiques,id',Rule::unique('candidatures')->where(fn($q)=>$q->where('email',$request->email))],'motivation'=>'nullable|string|max:2000']);
        $data['reference']='ADM-'.now()->format('ymd').'-'.Str::upper(Str::random(6));
        $candidature=Candidature::create($data);
        $this->emails->envoyer($candidature->email, $candidature->prenom.' '.$candidature->nom, 'Candidature',
            'Votre candidature INSEC a bien été reçue', 'Candidature enregistrée',
            'Votre demande de préinscription est maintenant enregistrée et sera étudiée par notre équipe.',
            ['Référence'=>$candidature->reference,'Diplôme'=>$candidature->formation->code,'Année'=>$candidature->anneeAcademique->libelle]);
        return redirect()->route('candidatures.confirmation',$candidature->reference);
    }

    public function confirmation(string $reference)
    {
        return view('candidatures.confirmation',['candidature'=>Candidature::where('reference',$reference)->firstOrFail()]);
    }

    public function index(Request $request)
    {
        $candidatures=Candidature::with(['formation','anneeAcademique'])->when($request->filled('statut'),fn($q)=>$q->where('statut',$request->statut))->latest()->paginate(20)->withQueryString();
        return view('candidatures.index',compact('candidatures'));
    }

    public function show(Candidature $candidature)
    {
        $candidature->load(['formation.ues','anneeAcademique','etudiant']);
        return view('candidatures.show',compact('candidature'));
    }

    public function update(Request $request,Candidature $candidature)
    {
        abort_if($candidature->statut==='Inscrite',422,'Cette candidature est déjà convertie.');
        $data=$request->validate(['statut'=>'required|in:Nouvelle,En étude,Admissible,Rejetée','note_interne'=>'nullable|string|max:2000']);
        $ancienStatut=$candidature->statut;
        $candidature->update($data+['traitee_at'=>now()]);
        if($ancienStatut!==$candidature->statut){
            $this->emails->envoyer($candidature->email,$candidature->prenom.' '.$candidature->nom,'Admission','Mise à jour de votre candidature INSEC','Décision d’admission',
                'Le statut de votre candidature a été mis à jour.',['Référence'=>$candidature->reference,'Nouveau statut'=>$candidature->statut,'Diplôme'=>$candidature->formation->code]);
        }
        return back()->with('success','Décision enregistrée.');
    }

    public function convertir(Request $request,Candidature $candidature)
    {
        abort_unless($candidature->statut==='Admissible',422,'La candidature doit être admissible avant inscription.');
        $data=$request->validate(['annee_parcours'=>['required','integer','min:1','max:3'],'date_inscription'=>'required|date','numero_inscription_intec'=>'nullable|string|max:100','financeur'=>'nullable|in:etudiant,bumex']);
        abort_if($data['annee_parcours']>$candidature->formation->duree_annees,422,'Année de parcours incompatible.');
        $ues=Ue::where('formation_id',$candidature->formation_id)->where('annee_parcours',$data['annee_parcours'])->where('active',true)->pluck('id');
        abort_if($ues->isEmpty(),422,'Aucune UE active pour cette année de parcours.');

        $etudiant=DB::transaction(function() use($candidature,$data,$ues){
            $etudiant=Etudiant::firstOrCreate(['email'=>$candidature->email],['nom'=>$candidature->nom,'prenom'=>$candidature->prenom,'telephone'=>$candidature->telephone,'statut_etudiant'=>'Actif']);
            $inscription=Inscription::create(['id_etudiant'=>$etudiant->id_etudiant,'id_formation'=>$candidature->formation_id,'id_annee_academique'=>$candidature->annee_academique_id,'annee_parcours'=>$data['annee_parcours'],'date_inscription'=>$data['date_inscription'],'numero_inscription_intec'=>$data['numero_inscription_intec']??null,'statut'=>'active','financeur'=>$data['financeur']??'etudiant']);
            $inscription->ues()->sync($ues);
            $inscription->synchroniserTarification();
            $candidature->update(['statut'=>'Inscrite','etudiant_id'=>$etudiant->id_etudiant,'traitee_at'=>now()]);
            return $etudiant;
        });
        $this->emails->envoyer($candidature->email,$candidature->prenom.' '.$candidature->nom,'Inscription','Votre inscription INSEC est confirmée','Inscription définitive confirmée',
            'Votre dossier étudiant et votre inscription ont été créés avec succès.',['Diplôme'=>$candidature->formation->code,'Année académique'=>$candidature->anneeAcademique->libelle,'N° INTEC'=>$data['numero_inscription_intec']??'En attente']);
        return redirect()->route('etudiants.show',$etudiant)->with('status','Candidature convertie en étudiant et inscription créée.');
    }
}
