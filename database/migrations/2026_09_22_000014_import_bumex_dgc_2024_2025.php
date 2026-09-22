<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('journal_audit')) return;

        $formationId = DB::table('formations')->where('code', 'DGC')->value('id');
        $anneeId = DB::table('annees_academiques')->where('libelle', '2024-2025')->value('id');
        $ues = DB::table('ues')->whereIn('code', ['TEC111', 'TEC115', 'TEC118', 'TEC119'])->pluck('id', 'code');
        if (! $formationId || ! $anneeId || $ues->count() !== 4) return;

        $candidats = [
            ['code'=>'100407419','nom'=>"B'LAL",'prenom'=>'Fatimetou','naissance'=>'1990-09-17','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>null,'TEC115'=>null,'TEC118'=>'ABS','TEC119'=>null]],
            ['code'=>'100407421','nom'=>'MESSOUD','prenom'=>'Vatimetou','naissance'=>'1998-03-06','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>'ABS','TEC115'=>'ABS','TEC118'=>'ABS','TEC119'=>1.5]],
            ['code'=>'100407424','nom'=>'FALL','prenom'=>'Cheikh Abdoul Aziz','naissance'=>'2005-11-22','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>1,'TEC115'=>1.5,'TEC118'=>'ABS','TEC119'=>0.5]],
            ['code'=>'100407423','nom'=>'TALEB','prenom'=>'Mohamed Lemine','naissance'=>'2004-04-02','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>0.5,'TEC115'=>2.5,'TEC118'=>0.5,'TEC119'=>0]],
            ['code'=>'100407425','nom'=>'HEMBARA','prenom'=>'Nane','naissance'=>'1999-08-24','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>3.5,'TEC115'=>1.5,'TEC118'=>3.5,'TEC119'=>1.5]],
            ['code'=>'100407426','nom'=>'EL HEYBE','prenom'=>'Ely Cheikh','naissance'=>'1999-12-20','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>'ABS','TEC115'=>'ABS','TEC118'=>'ABS','TEC119'=>'ABS']],
            ['code'=>'100407428','nom'=>'CHEIKH MOHAMED BEBECAR','prenom'=>'Jedu','naissance'=>'2003-07-31','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>3.5,'TEC115'=>5,'TEC118'=>8.5,'TEC119'=>1.5]],
            ['code'=>'100407429','nom'=>'MOUSTAPHE','prenom'=>'Hamade','naissance'=>'1997-10-12','inscription'=>'2024-11-26','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>2,'TEC115'=>4,'TEC118'=>3.5,'TEC119'=>8.5]],
            ['code'=>'100416112','nom'=>'ELEYAT','prenom'=>'Abdellahi','naissance'=>'2001-12-30','inscription'=>'2025-01-14','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>1,'TEC115'=>4,'TEC118'=>6,'TEC119'=>3]],
            ['code'=>'100416106','nom'=>'BERROU','prenom'=>'Oumkelthoum','naissance'=>'2002-07-15','inscription'=>'2025-01-14','ues'=>['TEC115'],'notes'=>['TEC115'=>null]],
            ['code'=>'100416114','nom'=>'HABIBY','prenom'=>'Seniya','naissance'=>'1993-04-16','inscription'=>'2025-01-14','ues'=>['TEC111','TEC115','TEC118','TEC119'],'notes'=>['TEC111'=>'ABS','TEC115'=>'ABS','TEC118'=>'ABS','TEC119'=>'ABS']],
        ];

        DB::transaction(function () use ($candidats, $formationId, $anneeId, $ues) {
            $maintenant = now();
            $examens = [];
            foreach ($ues as $code => $ueId) {
                DB::table('examens')->updateOrInsert(
                    ['ue_id'=>$ueId,'annee_academique_id'=>$anneeId,'session'=>'Normale'],
                    ['date_examen'=>'2025-05-05 00:00:00','note_sur'=>20,'seuil_validation'=>10,'statut'=>'Terminé','updated_at'=>$maintenant,'created_at'=>$maintenant]
                );
                $examens[$code] = DB::table('examens')->where(['ue_id'=>$ueId,'annee_academique_id'=>$anneeId,'session'=>'Normale'])->value('id');
            }

            foreach ($candidats as $candidat) {
                $etudiantId = DB::table('etudiants')->where('nom',$candidat['nom'])->where('prenom',$candidat['prenom'])->value('id_etudiant');
                if (! $etudiantId) {
                    $etudiantId = DB::table('etudiants')->insertGetId([
                        'nom'=>$candidat['nom'],'prenom'=>$candidat['prenom'],'date_naissance'=>$candidat['naissance'],
                        'email'=>null,'telephone'=>null,'statut_etudiant'=>'Actif','created_at'=>$maintenant,'updated_at'=>$maintenant,
                    ], 'id_etudiant');
                }

                DB::table('inscriptions')->updateOrInsert(
                    ['id_etudiant'=>$etudiantId,'id_formation'=>$formationId,'id_annee_academique'=>$anneeId],
                    ['annee_parcours'=>1,'date_inscription'=>$candidat['inscription'],'numero_inscription_intec'=>$candidat['code'],
                     'statut'=>'active','financeur'=>'bumex','prix_vente_ue_mru'=>16000,'cout_cnam_ue_eur'=>160,
                     'montant_du'=>count($candidat['ues'])*16000,'updated_at'=>$maintenant,'created_at'=>$maintenant]
                );
                $inscriptionId = DB::table('inscriptions')->where(['id_etudiant'=>$etudiantId,'id_formation'=>$formationId,'id_annee_academique'=>$anneeId])->value('id');

                foreach ($candidat['ues'] as $codeUe) {
                    DB::table('inscription_ue')->updateOrInsert(
                        ['inscription_id'=>$inscriptionId,'ue_id'=>$ues[$codeUe]],
                        ['statut'=>'inscrite','updated_at'=>$maintenant,'created_at'=>$maintenant]
                    );
                    $noteSource = $candidat['notes'][$codeUe] ?? null;
                    $presence = $noteSource === 'ABS' ? 'Non présenté' : (is_numeric($noteSource) ? 'Présent' : 'Non renseigné');
                    $commentaire = $presence === 'Non renseigné' ? 'Résultat absent du fichier source transmis.' : null;
                    if ($candidat['code'] === '100416106') {
                        $commentaire = 'Engagement financier : UE TEC115. Le fichier de résultats mentionne cette candidate uniquement en TEC119 avec ABS. À vérifier.';
                    }
                    DB::table('resultats_examens')->updateOrInsert(
                        ['examen_id'=>$examens[$codeUe],'inscription_id'=>$inscriptionId],
                        ['presence'=>$presence,'note'=>is_numeric($noteSource)?$noteSource:null,'commentaire'=>$commentaire,'updated_at'=>$maintenant,'created_at'=>$maintenant]
                    );
                }
            }

            $compte = DB::table('users')->where('email', 'mohamed.cheikh@bumex.mr')->first();
            DB::table('journal_audit')->insert([
                'user_id'=>$compte?->id,'acteur'=>$compte?->name ?? 'Mohamed Cheikh','action'=>'historical_import',
                'modele'=>'Etudiant','description'=>'Import contrôlé de 11 candidats DGC pris en charge par BUMEX pour 2024-2025',
                'apres'=>json_encode(['candidats'=>11,'financeur'=>'bumex','date_examen'=>'2025-05-05','source'=>'Engagements financiers lots 1 et 2 + Resultat DCG-INSEC 2025.xlsx'], JSON_UNESCAPED_UNICODE),
                'created_at'=>$maintenant,'updated_at'=>$maintenant,
            ]);
        });
    }

    public function down(): void {}
};
