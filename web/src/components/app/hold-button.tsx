import { cn } from "cn";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

/// Types and interfaces

interface HoldButtonProps {
  disabled?: boolean;
  onComplete: () => void;
  status: "idle" | "pending" | "success" | "error";
  idleLabel: string;
  doneLabel: string;
  failedLabel?: string;
  variant: keyof typeof HOLD_COLORS;
}

/// Constants
const HOLD_MS = 1500;

const HOLD_COLORS = {
  primary: {
    idle: "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    holding: "bg-primary text-primary-foreground",
    pending: "bg-primary text-primary-foreground",
    success: "bg-primary text-primary-foreground",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  destructive: {
    idle: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white",
    holding: "bg-destructive text-white hover:bg-destructive hover:text-white",
    pending: "bg-destructive text-white hover:bg-destructive hover:text-white",
    success: "bg-destructive text-primary-foreground hover:bg-destructive hover:text-white",
    error: "border-destructive bg-destructive/10 text-destructive",
  },
};
const HOLD_FILL_IDLE_STYLE = { width: "0%", transition: "none" };
const HOLD_FILL_ACTIVE_STYLE = {
  width: "100%",
  transition: `width ${String(HOLD_MS)}ms linear`,
};

export function HoldButton({
  disabled = false,
  onComplete,
  status,
  idleLabel,
  doneLabel,
  failedLabel,
  variant,
}: Readonly<HoldButtonProps>) {
  const [phase, setPhase] = useState<"idle" | "holding" | "held">("idle");
  const shown = phase === "held" ? status : phase;

  const handleHoldStart = useCallback(() => {
    setPhase("holding");
  }, []);

  const handleHoldCancel = useCallback(() => {
    setPhase((current) => (current === "holding" ? "idle" : current));
  }, []);

  const handleFillEnd = useCallback(() => {
    setPhase("held");
    onComplete();
  }, [onComplete]);

  return (
    <Button
      disabled={disabled || shown === "pending"}
      onPointerDown={handleHoldStart}
      onPointerUp={handleHoldCancel}
      onPointerLeave={handleHoldCancel}
      onPointerCancel={handleHoldCancel}
      className={cn(
        "relative h-11 overflow-hidden select-none",
        shown === "idle" && "border-border bg-background text-secondary-foreground",
        HOLD_COLORS[variant][shown],
        disabled && "border-border bg-muted text-muted-foreground disabled:opacity-100",
      )}
    >
      <span
        className="absolute inset-y-0 left-0 bg-white/30"
        style={phase === "holding" ? HOLD_FILL_ACTIVE_STYLE : HOLD_FILL_IDLE_STYLE}
        onTransitionEnd={handleFillEnd}
      />
      <span className="relative grid">
        <span className={cn("col-start-1 row-start-1", shown !== "idle" && "invisible")}>
          {idleLabel}
        </span>
        <span className={cn("col-start-1 row-start-1", shown !== "holding" && "invisible")}>
          Keep holding…
        </span>
        <span className={cn("col-start-1 row-start-1", shown !== "pending" && "invisible")}>
          Working…
        </span>
        <span className={cn("col-start-1 row-start-1", shown !== "success" && "invisible")}>
          {doneLabel}
        </span>
        <span className={cn("col-start-1 row-start-1", shown !== "error" && "invisible")}>
          {failedLabel}
        </span>
      </span>
    </Button>
  );
}
