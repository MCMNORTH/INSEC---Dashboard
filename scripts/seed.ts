/** Charge le référentiel initial (années, DGC/DSGC, UE). Idempotent. */
import "dotenv/config";
import { closeDb, getDb } from "../src/db";
import { seedReferentiel } from "../src/lib/seed";

seedReferentiel(getDb())
  .then(() => console.log("Référentiel chargé."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
