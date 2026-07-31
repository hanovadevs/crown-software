"use client";

import { DatabaseZap, LoaderCircle, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";

type RestoreResult = { success?: boolean; message?: string; error?: string; safetyBackup?: string };

export function RestoreForm() {
  const [result, setResult] = useState<RestoreResult>({});
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setResult({});
    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json()) as RestoreResult;
      setResult(payload);
      if (response.ok && payload.success) {
        window.setTimeout(() => window.location.assign("/login"), 2200);
      }
    } catch {
      setResult({ error: "The restore request could not be completed." });
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="restore-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="backup">PostgreSQL backup file</label>
        <input accept=".dump,application/octet-stream,application/vnd.postgresql.dump" className="input file-input" id="backup" name="backup" required type="file" />
        <small>Only Crown Accumulator custom-format .dump files, up to 250 MB.</small>
      </div>
      <div className="restore-fields">
        <div className="field">
          <label htmlFor="password">Administrator password</label>
          <input autoComplete="current-password" className="input" id="password" name="password" required type="password" />
        </div>
        <div className="field">
          <label htmlFor="confirmation">Type RESTORE CROWN</label>
          <input autoComplete="off" className="input" id="confirmation" name="confirmation" placeholder="RESTORE CROWN" required type="text" />
        </div>
      </div>
      {result.error ? <div className="form-error">{result.error}</div> : null}
      {result.success ? (
        <div className="form-success">
          {result.message} Recovery copy: {result.safetyBackup}
        </div>
      ) : null}
      <button className="button button-danger" disabled={working} type="submit">
        {working ? <LoaderCircle className="spin" size={18} /> : <DatabaseZap size={18} />}
        {working ? "Validating and restoring…" : "Import & Restore All Data"}
      </button>
      <p className="restore-note"><Upload size={15} /> A recovery backup is automatically saved before any data changes.</p>
    </form>
  );
}
