"use client";

import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="username">Username</label>
        <div className="input-wrap">
          <UserRound className="input-icon" size={20} />
          <input
            className="input has-icon"
            id="username"
            name="username"
            placeholder="Enter your username"
            autoComplete="username"
            required
            autoFocus
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="input-wrap">
          <LockKeyhole className="input-icon" size={20} />
          <input
            className="input has-icon"
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </div>
      </div>
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <button
        className={`button button-primary login-submit ${pending ? "loading-button" : ""}`}
        disabled={pending}
        type="submit"
      >
        <LogIn size={22} />
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
