import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import { getArtifactDirectory } from "../lib/paths";

const API_KEY_ENV = "INGRAVITY_API_KEY";
const API_KEY_FILE_ENV = "INGRAVITY_API_KEY_FILE";
const DEFAULT_API_KEY_FILE = path.join(
  getArtifactDirectory(),
  "data",
  "api-key",
);

let configuredApiKey: string | undefined;

async function loadApiKey(): Promise<string> {
  const fromEnvironment = process.env[API_KEY_ENV]?.trim();
  if (fromEnvironment) {
    return fromEnvironment;
  }

  const keyFile = process.env[API_KEY_FILE_ENV] || DEFAULT_API_KEY_FILE;
  try {
    const fromFile = (await readFile(keyFile, "utf8")).trim();
    if (fromFile) {
      return fromFile;
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const generatedKey = randomBytes(32).toString("base64url");
  await mkdir(path.dirname(keyFile), { recursive: true });
  await writeFile(keyFile, `${generatedKey}\n`, { encoding: "utf8", mode: 0o600 });
  return generatedKey;
}

export async function initializeApiKey(): Promise<{ key: string; source: string }> {
  const fromEnvironment = process.env[API_KEY_ENV]?.trim();
  const keyFile = process.env[API_KEY_FILE_ENV] || DEFAULT_API_KEY_FILE;
  configuredApiKey = await loadApiKey();
  return {
    key: configuredApiKey,
    source: fromEnvironment ? `variable ${API_KEY_ENV}` : keyFile,
  };
}

export function hasValidApiKey(candidate: string | undefined): boolean {
  if (!configuredApiKey || !candidate) {
    return false;
  }

  const expected = Buffer.from(configuredApiKey);
  const received = Buffer.from(candidate);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export const requireApiKey: RequestHandler = (req, res, next): void => {
  const candidate = req.header("X-API-Key");
  if (!hasValidApiKey(candidate)) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Une clé API valide est requise dans l’en-tête X-API-Key.",
    });
    return;
  }

  next();
};
