import { cn } from "cn";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const HOLD_MS = 1500;

const HOLD_FILL_IDLE_STYLE = { width: "0%", transition: "none" };
const HOLD_FILL_ACTIVE_STYLE = {
  width: "100%",
  transition: `width ${String(HOLD_MS)}ms linear`,
};

const HOLD_COLORS = {
  primary: {
    idle: "border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
    holding: "bg-primary text-primary-foreground",
    done: "bg-primary text-primary-foreground",
  },
  destructive: {
    idle: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white",
    holding: "bg-destructive text-white hover:bg-destructive hover:text-white",
    done: "bg-destructive text-primary-foreground hover:bg-destructive hover:text-white",
  },
};

interface HoldButtonProps {
  disabled?: boolean;
  onComplete: () => void;
  idleLabel: string;
  doneLabel: string;
  variant: keyof typeof HOLD_COLORS;
}

export function HoldButton({
  disabled,
  onComplete,
  idleLabel,
  doneLabel,
  variant,
}: Readonly<HoldButtonProps>) {
  const [phase, setPhase] = useState<"idle" | "holding" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleHoldStart = useCallback(() => {
    setPhase("holding");
    timer.current = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, HOLD_MS);
  }, [onComplete]);

  const handleHoldCancel = useCallback(() => {
    // The pointer also lifts after a completed hold, which must not undo "done"
    setPhase((current) => (current === "holding" ? "idle" : current));
    clearTimeout(timer.current);
  }, []);

  const labels = { idle: idleLabel, holding: "Keep holding…", done: doneLabel };

  return (
    <Button
      disabled={disabled}
      onPointerDown={handleHoldStart}
      onPointerUp={handleHoldCancel}
      onPointerLeave={handleHoldCancel}
      onPointerCancel={handleHoldCancel}
      className={cn(
        "relative overflow-hidden select-none",
        phase === "idle" && "border-border bg-background text-secondary-foreground",
        HOLD_COLORS[variant][phase],
      )}
    >
      <span
        className="absolute inset-y-0 left-0 bg-white/30"
        style={phase === "holding" ? HOLD_FILL_ACTIVE_STYLE : HOLD_FILL_IDLE_STYLE}
      />
      <span className="relative grid">
        {Object.values(labels).map((text) => (
          <span
            key={text}
            className={cn("col-start-1 row-start-1", text !== labels[phase] && "invisible")}
          >
            {text}
          </span>
        ))}
      </span>
    </Button>
  );
}
