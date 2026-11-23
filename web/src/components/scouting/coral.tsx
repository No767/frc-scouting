import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";

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

function CoralButton({ level, count, setLevel, maxPerLevel }: Readonly<CoralButtonProps>) {
  const handleDecrease = useCallback(() => {
    setLevel(level, count - 1);
  }, [count, level, setLevel]);
  const handleIncrease = useCallback(() => {
    setLevel(level, count + 1);
  }, [count, level, setLevel]);

  return (
    <div className="relative flex items-center gap-1 sm:gap-2">
      <FieldLabel className="absolute right-full w-8 text-[18px] font-semibold">{level}</FieldLabel>
      <Button
        size="icon"
        aria-label="Decrease"
        disabled={count === 0}
        onClick={handleDecrease}
        className="size-11"
      >
        <Minus />
      </Button>
      <span className="flex h-11 w-10 items-center justify-center rounded-md border text-[16px] font-semibold tabular-nums sm:w-12">
        {count}
      </span>
      <Button
        size="icon"
        aria-label="Increase"
        disabled={count >= maxPerLevel}
        onClick={handleIncrease}
        className="size-11"
      >
        <Plus />
      </Button>
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
    <Field>
      <FieldLabel className="justify-center text-lg font-semibold">Coral</FieldLabel>
      <div className="flex flex-col items-center gap-3">
        <CoralButton
          level="L4"
          count={levels.L4}
          setLevel={handleLevelChange}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L3"
          count={levels.L3}
          setLevel={handleLevelChange}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L2"
          count={levels.L2}
          setLevel={handleLevelChange}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L1"
          count={levels.L1}
          setLevel={handleLevelChange}
          maxPerLevel={maxPerLevel}
        />
      </div>
    </Field>
  );
}
