"use client";

import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export function GraphiqueEncaissements({ libelles, valeurs }: { libelles: string[]; valeurs: number[] }) {
  return (
    <Bar
      aria-label="Encaissements mensuels"
      height={90}
      data={{
        labels: libelles,
        datasets: [{ data: valeurs, backgroundColor: "#1E2761", borderRadius: 5, maxBarThickness: 34 }],
      }}
      options={{
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${new Intl.NumberFormat("fr-FR").format(Number(c.raw))} MRU` } },
        },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
      }}
    />
  );
}

export function GraphiqueStatuts({ repartition }: { repartition: Record<string, number> }) {
  const statuts = ["Actif", "Suspendu", "Diplômé", "Abandon"];
  return (
    <Doughnut
      aria-label="Situation des étudiants"
      height={190}
      data={{
        labels: statuts,
        datasets: [
          {
            data: statuts.map((s) => repartition[s] ?? 0),
            backgroundColor: ["#16a34a", "#d97706", "#2563eb", "#dc2626"],
            borderWidth: 0,
          },
        ],
      }}
      options={{ cutout: "68%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true } } } }}
    />
  );
}
