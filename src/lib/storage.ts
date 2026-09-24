/**
 * Stockage des fichiers (pièces administratives et sauvegardes).
 *
 * - STORAGE_DRIVER=s3        → tout service compatible S3 (Cloudflare R2, Backblaze B2, AWS S3…),
 *                             bucket privé : les fichiers ne sont servis qu'à travers l'application.
 * - STORAGE_DRIVER=database  → (par défaut) fichiers stockés dans la table `fichiers` de PostgreSQL.
 *                             Pratique pour démarrer, mais les sauvegardes restent alors dans la même base.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq, like, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { getDb } from "@/db";
import { fichiers } from "@/db/schema";

export type ObjetStocke = { chemin: string; taille: number; modifieLe: Date };

export interface Stockage {
  readonly pilote: "database" | "s3";
  ecrire(chemin: string, contenu: Uint8Array, mimeType: string): Promise<void>;
  lire(chemin: string): Promise<Uint8Array | null>;
  supprimer(chemin: string): Promise<void>;
  lister(prefixe: string): Promise<ObjetStocke[]>;
}

export function cheminValide(chemin: string): boolean {
  return !!chemin && !chemin.startsWith("/") && !chemin.split("/").some((p) => p === ".." || p === "");
}

function verifier(chemin: string) {
  if (!cheminValide(chemin)) throw new Error(`Chemin de fichier invalide : ${chemin}`);
}

export class StockageBase implements Stockage {
  readonly pilote = "database" as const;
  constructor(private readonly db: Db) {}

  async ecrire(chemin: string, contenu: Uint8Array, mimeType: string) {
    verifier(chemin);
    const buffer = Buffer.from(contenu);
    await this.db
      .insert(fichiers)
      .values({ chemin, contenu: buffer, mimeType, taille: buffer.length })
      .onConflictDoUpdate({
        target: fichiers.chemin,
        set: { contenu: buffer, mimeType, taille: buffer.length, createdAt: new Date() },
      });
  }

  async lire(chemin: string) {
    verifier(chemin);
    const [row] = await this.db.select({ contenu: fichiers.contenu }).from(fichiers).where(eq(fichiers.chemin, chemin));
    return row ? new Uint8Array(row.contenu) : null;
  }

  async supprimer(chemin: string) {
    verifier(chemin);
    await this.db.delete(fichiers).where(eq(fichiers.chemin, chemin));
  }

  async lister(prefixe: string) {
    const echappe = prefixe.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await this.db
      .select({ chemin: fichiers.chemin, taille: fichiers.taille, createdAt: fichiers.createdAt })
      .from(fichiers)
      .where(like(fichiers.chemin, sql`${echappe + "%"}`))
      .orderBy(fichiers.chemin);
    return rows.map((r) => ({ chemin: r.chemin, taille: r.taille, modifieLe: r.createdAt }));
  }
}

export class StockageS3 implements Stockage {
  readonly pilote = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET n’est pas configuré.");
    this.bucket = bucket;
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  async ecrire(chemin: string, contenu: Uint8Array, mimeType: string) {
    verifier(chemin);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: chemin, Body: contenu, ContentType: mimeType }),
    );
  }

  async lire(chemin: string) {
    verifier(chemin);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: chemin }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async supprimer(chemin: string) {
    verifier(chemin);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chemin }));
  }

  async lister(prefixe: string) {
    const out: ObjetStocke[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefixe, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) {
        if (o.Key) out.push({ chemin: o.Key, taille: o.Size ?? 0, modifieLe: o.LastModified ?? new Date(0) });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out.sort((a, b) => a.chemin.localeCompare(b.chemin));
  }
}

let instance: Stockage | null = null;

export function getStockage(db: Db = getDb()): Stockage {
  if ((process.env.STORAGE_DRIVER || "database") === "s3") {
    instance ??= new StockageS3();
    return instance;
  }
  return new StockageBase(db);
}
