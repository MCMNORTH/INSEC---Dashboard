/* Documents PDF officiels (attestation, relevé, convocation, reçu) générés avec @react-pdf/renderer. */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

const NAVY = "#1e2761";
const OR = "#d4af37";

const s = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 70, paddingHorizontal: 57, fontFamily: "Helvetica", fontSize: 10.5, color: "#202020" },
  header: { borderBottomWidth: 3, borderBottomColor: OR, paddingBottom: 12, marginBottom: 28 },
  brand: { color: NAVY, fontSize: 24, fontFamily: "Helvetica-Bold" },
  subtitle: { color: "#666", marginTop: 2 },
  title: { textAlign: "center", color: NAVY, fontSize: 19, textTransform: "uppercase", marginVertical: 26, fontFamily: "Helvetica-Bold" },
  p: { marginBottom: 8, lineHeight: 1.5 },
  box: { borderWidth: 1, borderColor: "#dddddd", backgroundColor: "#fafafa", padding: 14, marginVertical: 12, lineHeight: 1.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#dddddd", marginVertical: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dddddd" },
  th: { backgroundColor: NAVY, color: "white", padding: 7, fontFamily: "Helvetica-Bold" },
  td: { padding: 7 },
  total: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10 },
  signature: { marginTop: 45, textAlign: "right", lineHeight: 1.6 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 57,
    right: 57,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    paddingTop: 8,
    color: "#777",
    fontSize: 8.5,
  },
});

function Gabarit({ titre, pied, children }: { titre: string; pied: string; children: ReactNode }) {
  return (
    <Document title={titre} author="INSEC" creator="INSEC Dashboard" producer="INSEC Dashboard" language="fr">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>INSEC</Text>
          <Text style={s.subtitle}>Centre associé INTEC-CNAM · DGC & DSGC</Text>
        </View>
        <Text style={s.title}>{titre}</Text>
        {children}
        <Text style={s.footer} fixed>
          {pied}
        </Text>
      </Page>
    </Document>
  );
}

type Ligne = { cellules: string[] };

function Tableau({ entetes, lignes, largeurs }: { entetes: string[]; lignes: Ligne[]; largeurs: number[] }) {
  return (
    <View style={s.table}>
      <View style={s.tr}>
        {entetes.map((h, i) => (
          <Text key={h} style={[s.th, { width: `${largeurs[i]}%` }]}>
            {h}
          </Text>
        ))}
      </View>
      {lignes.map((l, r) => (
        <View key={r} style={s.tr} wrap={false}>
          {l.cellules.map((c, i) => (
            <Text key={i} style={[s.td, { width: `${largeurs[i]}%`, textAlign: l.cellules.length === 1 ? "center" : "left" }]}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function TableauCles({ lignes }: { lignes: [string, string, boolean?][] }) {
  return (
    <View style={s.table}>
      {lignes.map(([cle, valeur, fort]) => (
        <View key={cle} style={s.tr} wrap={false}>
          <Text style={[s.th, { width: "32%" }]}>{cle}</Text>
          <Text style={[s.td, { width: "68%" }, fort ? s.total : {}]}>{valeur}</Text>
        </View>
      ))}
    </View>
  );
}

export type DonneesAttestation = {
  nom: string;
  prenom: string;
  email: string;
  numeroIntec: string | null;
  formationLibelle: string;
  formationCode: string;
  anneeParcours: number | null;
  annee: string;
  ues: string[];
  date: string;
  reference: string;
};

export function Attestation(d: DonneesAttestation) {
  return (
    <Gabarit titre="Attestation d'inscription" pied={`Document généré par INSEC Dashboard · Référence ${d.reference}`}>
      <Text style={s.p}>Nous attestons que :</Text>
      <View style={s.box}>
        <Text style={s.bold}>
          {d.nom.toUpperCase()} {d.prenom}
        </Text>
        <Text>E-mail : {d.email}</Text>
        <Text>N° INTEC : {d.numeroIntec ?? "Non renseigné"}</Text>
      </View>
      <Text style={s.p}>
        est inscrit(e) au diplôme{" "}
        <Text style={s.bold}>
          {d.formationLibelle} ({d.formationCode})
        </Text>
        , en année {d.anneeParcours ?? "—"}, pour l&apos;année académique <Text style={s.bold}>{d.annee}</Text>.
      </Text>
      <Text style={s.p}>UE suivies : {d.ues.length ? d.ues.join(", ") : "—"}.</Text>
      <View style={s.signature}>
        <Text>Fait le {d.date}</Text>
        <Text> </Text>
        <Text style={s.bold}>La Direction de l&apos;INSEC</Text>
      </View>
    </Gabarit>
  );
}

export type DonneesReleve = {
  nom: string;
  prenom: string;
  formationCode: string;
  annee: string;
  anneeParcours: number | null;
  numeroIntec: string | null;
  lignes: { ue: string; session: string; date: string; note: string; resultat: string }[];
  credits: number;
  genereLe: string;
};

export function Releve(d: DonneesReleve) {
  return (
    <Gabarit titre="Relevé de notes" pied={`Document généré le ${d.genereLe} · INSEC Dashboard`}>
      <View style={s.box}>
        <Text style={s.bold}>
          {d.nom.toUpperCase()} {d.prenom}
        </Text>
        <Text>
          {d.formationCode} · {d.annee} · Année {d.anneeParcours ?? "—"}
        </Text>
        <Text>N° INTEC : {d.numeroIntec ?? "Non renseigné"}</Text>
      </View>
      <Tableau
        entetes={["UE", "Session", "Date", "Note", "Résultat"]}
        largeurs={[40, 15, 15, 14, 16]}
        lignes={
          d.lignes.length
            ? d.lignes.map((l) => ({ cellules: [l.ue, l.session, l.date, l.note, l.resultat] }))
            : [{ cellules: ["Aucun résultat enregistré."] }]
        }
      />
      <Text style={s.total}>Crédits validés : {d.credits} ECTS</Text>
    </Gabarit>
  );
}

export type DonneesConvocation = {
  nom: string;
  prenom: string;
  formationCode: string;
  numeroIntec: string | null;
  ue: string;
  session: string;
  date: string;
  salle: string | null;
  annee: string;
  numero: string;
  genereLe: string;
};

export function Convocation(d: DonneesConvocation) {
  return (
    <Gabarit titre="Convocation à l'examen" pied={`Convocation n° ${d.numero} · Générée le ${d.genereLe}`}>
      <Text style={s.p}>Étudiant(e) :</Text>
      <View style={s.box}>
        <Text style={s.bold}>
          {d.nom.toUpperCase()} {d.prenom}
        </Text>
        <Text>
          {d.formationCode} · N° INTEC {d.numeroIntec ?? "Non renseigné"}
        </Text>
      </View>
      <TableauCles
        lignes={[
          ["UE", d.ue],
          ["Session", d.session],
          ["Date et heure", d.date],
          ["Lieu / salle", d.salle ?? "À confirmer"],
          ["Année académique", d.annee],
        ]}
      />
      <Text style={[s.p, { marginTop: 25 }]}>
        Veuillez vous présenter 30 minutes avant l&apos;épreuve avec une pièce d&apos;identité et cette convocation.
      </Text>
      <View style={s.signature}>
        <Text style={s.bold}>La Direction de l&apos;INSEC</Text>
      </View>
    </Gabarit>
  );
}

export type DonneesRecu = {
  numero: string | null;
  date: string;
  statut: string;
  etudiant: string;
  formation: string;
  montant: string;
  mode: string;
  reference: string | null;
  inscriptionId: number;
};

export function Recu(d: DonneesRecu) {
  return (
    <Gabarit titre="Reçu de paiement" pied={`Ce reçu est rattaché à l'inscription n° ${d.inscriptionId} · INSEC Dashboard`}>
      <View style={s.box}>
        <Text style={s.total}>{d.numero ?? "Reçu provisoire"}</Text>
        <Text>
          Date : {d.date} · Statut : {d.statut}
        </Text>
      </View>
      <TableauCles
        lignes={[
          ["Étudiant", d.etudiant],
          ["Formation", d.formation],
          ["Montant reçu", d.montant, true],
          ["Mode", d.mode],
          ["Référence", d.reference ?? "—"],
        ]}
      />
      <View style={s.signature}>
        <Text>Cachet et signature</Text>
        <Text> </Text>
        <Text style={s.bold}>Service financier INSEC</Text>
      </View>
    </Gabarit>
  );
}
