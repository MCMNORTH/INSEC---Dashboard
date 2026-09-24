type Valeurs = { nom: string; prenom: string; specialite: string; email: string; telephone: string | null };

export function ChampsEnseignant({ valeurs }: { valeurs?: Valeurs }) {
  const champs: [keyof Valeurs, string, string, boolean][] = [
    ["nom", "Nom", "text", true],
    ["prenom", "Prénom", "text", true],
    ["specialite", "Spécialité", "text", true],
    ["email", "E-mail", "email", true],
    ["telephone", "Téléphone", "tel", false],
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {champs.map(([nom, libelle, type, requis]) => (
        <label key={nom} className="text-sm text-gray-600">
          {libelle}
          <input type={type} name={nom} required={requis} defaultValue={valeurs?.[nom] ?? ""} className="w-full rounded-lg mt-1" />
        </label>
      ))}
    </div>
  );
}
