"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="small-icon-button danger-icon" disabled={pending} type="submit" aria-label={label} title={label}>
      <Trash2 size={17} />
    </button>
  );
}

export function DeleteButton({
  action,
  confirmMessage,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  label: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <SubmitButton label={label} />
    </form>
  );
}
