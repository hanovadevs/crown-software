import "server-only";

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BACKUP_BYTES = 250 * 1024 * 1024;
const BACKUP_MAGIC = Buffer.from("PGDMP");
const REQUIRED_TABLES = [
  "users",
  "parties",
  "products",
  "transactions",
  "inventory_movements",
  "workers",
  "worker_payments",
  "app_settings",
] as const;

export class BackupValidationError extends Error {}

function connection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured.");
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
}

async function executable(tool: "pg_dump" | "pg_restore") {
  const filename = process.platform === "win32" ? `${tool}.exe` : tool;
  const candidates = [
    process.env.POSTGRES_BIN ? path.join(process.env.POSTGRES_BIN, filename) : "",
    process.platform === "win32"
      ? path.join("C:\\Program Files\\PostgreSQL\\18\\bin", filename)
      : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next configured location.
    }
  }
  return tool;
}

async function runPostgresTool(
  tool: "pg_dump" | "pg_restore",
  args: string[],
  input?: Buffer,
) {
  const config = connection();
  const command = await executable(tool);
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PGPASSWORD: config.password },
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let outputSize = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > MAX_BACKUP_BYTES) {
        child.kill();
        reject(new Error("The generated backup exceeds the 250 MB safety limit."));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(Buffer.concat(errors).toString("utf8").trim() || `${tool} exited with code ${code}.`));
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function connectionArgs() {
  const config = connection();
  return [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--username=${config.user}`,
    `--dbname=${config.database}`,
  ];
}

export function backupChecksum(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export function validateBackupHeader(data: Buffer) {
  if (!data.length) throw new BackupValidationError("The selected backup is empty.");
  if (data.length > MAX_BACKUP_BYTES) throw new BackupValidationError("The backup exceeds the 250 MB upload limit.");
  if (!data.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new BackupValidationError("This is not a valid PostgreSQL custom-format backup.");
  }
}

export async function createDatabaseBackup() {
  return runPostgresTool("pg_dump", [
    ...connectionArgs(),
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-privileges",
  ]);
}

export async function inspectDatabaseBackup(data: Buffer) {
  validateBackupHeader(data);
  const listing = (await runPostgresTool("pg_restore", ["--list"], data)).toString("utf8");
  const missing = REQUIRED_TABLES.filter(
    (table) => !new RegExp(`TABLE(?: DATA)? public ${table}(?:\\s|$)`, "m").test(listing),
  );
  if (missing.length) {
    throw new BackupValidationError(`Backup is incompatible. Missing required tables: ${missing.join(", ")}.`);
  }
  return { checksum: backupChecksum(data), size: data.length };
}

function backupDirectory() {
  return path.join(process.cwd(), "backups");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

export async function saveSafetyBackup(data: Buffer) {
  const directory = backupDirectory();
  await mkdir(directory, { recursive: true });
  const filename = `pre-restore-${timestamp()}.dump`;
  await writeFile(path.join(directory, filename), data, { flag: "wx" });

  const backups = (await listSafetyBackups()).slice(5);
  await Promise.all(backups.map((backup) => unlink(path.join(directory, backup.filename))));
  return filename;
}

export async function listSafetyBackups() {
  const directory = backupDirectory();
  try {
    const entries = await readdir(directory);
    const details = await Promise.all(
      entries
        .filter((name) => /^pre-restore-.*\.dump$/.test(name))
        .map(async (filename) => {
          const info = await stat(path.join(directory, filename));
          return { filename, size: info.size, createdAt: info.mtime };
        }),
    );
    return details.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function readSafetyBackup(filename: string) {
  if (!/^pre-restore-[\w.-]+\.dump$/.test(filename)) throw new Error("Invalid backup filename.");
  return readFile(path.join(backupDirectory(), filename));
}

export async function restoreDatabase(data: Buffer) {
  await inspectDatabaseBackup(data);
  await runPostgresTool(
    "pg_restore",
    [
      ...connectionArgs(),
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
    ],
    data,
  );
}

export function formatBackupBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
