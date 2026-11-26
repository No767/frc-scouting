import { cn } from "cn";
import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

/// Types and Interfaces

interface CoralProps {
  levels: CoralLevels;
  setLevels: (levels: CoralLevels) => void;
  maxPerLevel: number;
}

interface CoralButtonProps {
  level: keyof CoralLevels;
  count: number;
  setLevel: (level: keyof CoralLevels, count: number) => void;
  maxPerLevel: number;
}

export interface CoralLevels {
  L4: number;
  L3: number;
  L2: number;
  L1: number;
}

/// Constants - stable/empty data

const CORAL_LEVELS = ["L4", "L3", "L2", "L1"] as const;

/// Components

function CoralButton({ level, count, setLevel, maxPerLevel }: Readonly<CoralButtonProps>) {
  const handleDecrease = useCallback(() => {
    setLevel(level, count - 1);
  }, [count, level, setLevel]);
  const handleIncrease = useCallback(() => {
    setLevel(level, count + 1);
  }, [count, level, setLevel]);

  return (
    <div
      className={cn(
        "flex h-15 items-center justify-between rounded-[16px] border pr-2 pl-4.5",
        "sm:h-16.5 sm:rounded-[18px] sm:pr-2.5 sm:pl-5",
        "xl:h-15.5 xl:rounded-[16px] xl:pr-2 xl:pl-4.5",
        "max-lg:landscape:h-13 max-lg:landscape:rounded-[14px] max-lg:landscape:pr-1 max-lg:landscape:pl-3.5",
      )}
    >
      <span className="text-lg font-semibold sm:text-xl xl:text-lg max-lg:landscape:text-base">
        {level}
      </span>
      <div className="flex items-center gap-2 sm:gap-2.5 xl:gap-2 max-lg:landscape:gap-1.5">
        <Button
          size="icon"
          aria-label={`Decrease ${level}`}
          disabled={count === 0}
          onClick={handleDecrease}
          className="size-11 sm:size-12 xl:size-11 max-lg:landscape:size-11"
        >
          <Minus
            strokeWidth={2.25}
            className="size-4.5 sm:size-5 xl:size-4.5 max-lg:landscape:size-4"
          />
        </Button>
        <span
          className={cn(
            "flex h-11 w-13 items-center justify-center rounded-[12px] border text-lg font-bold tabular-nums",
            "sm:h-12 sm:w-14 sm:text-xl xl:h-11 xl:w-13 xl:text-lg",
            "max-lg:landscape:h-10 max-lg:landscape:w-11 max-lg:landscape:rounded-[10px] max-lg:landscape:text-base",
          )}
        >
          {count}
        </span>
        <Button
          size="icon"
          aria-label={`Increase ${level}`}
          disabled={count >= maxPerLevel}
          onClick={handleIncrease}
          className="size-11 sm:size-12 xl:size-11 max-lg:landscape:size-11"
        >
          <Plus
            strokeWidth={2.25}
            className="size-4.5 sm:size-5 xl:size-4.5 max-lg:landscape:size-4"
          />
        </Button>
      </div>
    </div>
  );
}

export function Coral({ levels, setLevels, maxPerLevel }: Readonly<CoralProps>) {
  const handleLevelChange = useCallback(
    (level: keyof CoralLevels, count: number) => {
      setLevels({ ...levels, [level]: count });
    },
    [levels, setLevels],
  );

  return (
    <section aria-label="Coral" className="flex flex-col gap-2 sm:gap-2.5 max-lg:landscape:gap-1.5">
      <div
        className={cn(
          "flex items-baseline justify-between px-1 pb-1",
          "sm:h-7 sm:px-0 sm:pb-0",
          "max-lg:landscape:h-5.5 max-lg:landscape:px-0 max-lg:landscape:pb-0",
        )}
      >
        <h2 className="text-lg font-semibold max-lg:landscape:text-[15px]">Coral</h2>
        <span className="text-[13px] text-muted-foreground max-lg:landscape:text-xs">
          {levels.L4 + levels.L3 + levels.L2 + levels.L1} scored
        </span>
      </div>
      {CORAL_LEVELS.map((level) => (
        <CoralButton
          key={level}
          level={level}
          count={levels[level]}
          setLevel={handleLevelChange}
          maxPerLevel={maxPerLevel}
        />
      ))}
    </section>
  );
}
