"use client";

import { LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/business";

const initialState: FormState = {};

export function PasswordForm({ required }: { required: boolean }) {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialState,
  );
  return (
    <form action={action} className="card panel settings-card">
      <div className="settings-heading">
        <span className="table-icon blue">
          <LockKeyhole size={19} />
        </span>
        <div>
          <h2>Change Password</h2>
          <p>
            {required
              ? "The bootstrap password must be replaced before production use."
              : "Update your account password and sign in again."}
          </p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="currentPassword">Current Password</label>
        <input
          className="input"
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">New Password</label>
        <input
          className="input"
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirm New Password</label>
        <input
          className="input"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && <div className="form-error">{state.error}</div>}
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
