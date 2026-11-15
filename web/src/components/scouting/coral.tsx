import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";

interface CoralProps {
  levels: CoralLevels;
  setLevels: (levels: CoralLevels) => void;
  maxTotal: number;
  maxPerLevel: number;
}

interface CoralButtonProps {
  level: keyof CoralLevels;
  count: number;
  total: number;
  setLevel: (level: keyof CoralLevels, count: number) => void;
  maxTotal: number;
  maxPerLevel: number;
}

export interface CoralLevels {
  L4: number;
  L3: number;
  L2: number;
  L1: number;
}

function CoralButton({
  level,
  count,
  total,
  setLevel,
  maxTotal,
  maxPerLevel,
}: Readonly<CoralButtonProps>) {
  const handleDecrease = useCallback(() => {
    setLevel(level, count - 1);
  }, [count, level, setLevel]);
  const handleIncrease = useCallback(() => {
    if (count < maxPerLevel && total < maxTotal) setLevel(level, count + 1);
  }, [count, level, maxPerLevel, maxTotal, setLevel, total]);

  return (
    <div className="relative flex items-center gap-2">
      <FieldLabel className="absolute right-full w-8 text-[18px] font-semibold">{level}</FieldLabel>
      <Button size="icon" aria-label="Decrease" disabled={count === 0} onClick={handleDecrease}>
        <Minus />
      </Button>
      <span className="flex h-9 w-12 items-center justify-center rounded-md border text-[16px] font-semibold tabular-nums">
        {count}
      </span>
      <Button size="icon" aria-label="Increase" onClick={handleIncrease}>
        <Plus />
      </Button>
    </div>
  );
}

export function Coral({ levels, setLevels, maxTotal, maxPerLevel }: Readonly<CoralProps>) {
  const total = levels.L4 + levels.L3 + levels.L2 + levels.L1;

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
          total={total}
          setLevel={handleLevelChange}
          maxTotal={maxTotal}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L3"
          count={levels.L3}
          total={total}
          setLevel={handleLevelChange}
          maxTotal={maxTotal}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L2"
          count={levels.L2}
          total={total}
          setLevel={handleLevelChange}
          maxTotal={maxTotal}
          maxPerLevel={maxPerLevel}
        />
        <CoralButton
          level="L1"
          count={levels.L1}
          total={total}
          setLevel={handleLevelChange}
          maxTotal={maxTotal}
          maxPerLevel={maxPerLevel}
        />
      </div>
    </Field>
  );
}
