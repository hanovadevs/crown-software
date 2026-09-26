"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

export function DeleteButton({
  action,
  confirmMessage,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  label: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm(confirmMessage)) return;
        const data = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          try {
            await action(data);
          } catch (caught) {
            if (caught && typeof caught === "object" && "digest" in caught &&
                typeof caught.digest === "string" && caught.digest.startsWith("NEXT_REDIRECT")) {
              throw caught;
            }
            setError(caught instanceof Error ? caught.message : "The action could not be completed.");
          }
        });
      }}
    >
      <button className="small-icon-button danger-icon" disabled={pending} type="submit" aria-label={label} title={label}>
        <Trash2 size={17} />
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </form>
  );
}
