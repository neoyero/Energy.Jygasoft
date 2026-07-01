import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Cifrado de secretos de integraciones (AES-256-GCM autenticado).
 *
 * - La llave maestra (`CONFIG_ENC_KEY`, 32 bytes en base64) vive SOLO en el env.
 * - Cada secreto lleva un IV aleatorio (12B) y su authTag (16B). El AAD ata el
 *   ciphertext a su ubicación lógica (`clave:campo`) para que no pueda moverse a
 *   otro campo/integración.
 * - Rotación: si el authTag no valida con la llave actual, se intenta con
 *   `CONFIG_ENC_KEY_PREV` (permite recifrar sin downtime).
 */

/** Blob cifrado persistido en el jsonb `secretos`. */
export interface SecretoCifrado {
  ct: string; // ciphertext base64
  iv: string; // nonce base64 (12 bytes)
  tag: string; // authTag base64 (16 bytes)
  v: number; // versión de esquema/llave
}

function parseKey(b64: string | undefined): Buffer | null {
  if (!b64) return null;
  try {
    const key = Buffer.from(b64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

const KEY = parseKey(serverEnv?.CONFIG_ENC_KEY);
const KEY_PREV = parseKey(serverEnv?.CONFIG_ENC_KEY_PREV);

/** true si hay una llave maestra válida (32 bytes) configurada. */
export function configCryptoDisponible(): boolean {
  return KEY != null;
}

/** Cifra `plaintext` atándolo al AAD `"clave:campo"`. Lanza si no hay llave. */
export function cifrarSecreto(aad: string, plaintext: string): SecretoCifrado {
  if (!KEY) throw new Error("CONFIG_ENC_KEY no configurada o inválida.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ct: ct.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    v: 1,
  };
}

function descifrarCon(key: Buffer, aad: string, blob: SecretoCifrado): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(blob.ct, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/**
 * Descifra un blob atado al AAD `"clave:campo"`. Intenta con la llave actual y,
 * si el authTag no valida (llave rotada), con la previa. Devuelve null si no se
 * puede descifrar (llave ausente o dato manipulado) — nunca devuelve basura.
 */
export function descifrarSecreto(aad: string, blob: SecretoCifrado): string | null {
  if (KEY) {
    try {
      return descifrarCon(KEY, aad, blob);
    } catch {
      /* intenta con la previa */
    }
  }
  if (KEY_PREV) {
    try {
      return descifrarCon(KEY_PREV, aad, blob);
    } catch {
      /* no se pudo */
    }
  }
  return null;
}

/** Type guard tolerante para el jsonb persistido. */
export function esSecretoCifrado(v: unknown): v is SecretoCifrado {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as SecretoCifrado).ct === "string" &&
    typeof (v as SecretoCifrado).iv === "string" &&
    typeof (v as SecretoCifrado).tag === "string"
  );
}
