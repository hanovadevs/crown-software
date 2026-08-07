"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackForwardNav() {
  const router = useRouter();

  return (
    <div className="back-forward-nav">
      <button
        className="icon-button header-nav-btn"
        onClick={() => router.back()}
        type="button"
        title="Go back"
        aria-label="Go back"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        className="icon-button header-nav-btn"
        onClick={() => router.forward()}
        type="button"
        title="Go forward"
        aria-label="Go forward"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
