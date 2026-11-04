import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";

export interface CoralProps {
  levels: number[];
  setLevels: (levels: number[]) => void;
  maxTotal: number;
  maxPerLevel: number;
}

interface CoralButtonProps {
  index: number;
  label: string;
  level: number;
  other: number;
  setLevel: (index: number, level: number) => void;
  maxTotal: number;
  maxPerLevel: number;
}

function CoralButton({
  index,
  label,
  level,
  other,
  setLevel,
  maxTotal,
  maxPerLevel,
}: Readonly<CoralButtonProps>) {
  const handleDecrease = useCallback(() => {
    setLevel(index, Math.max(level - 1, 0));
  }, [index, level, setLevel]);
  const handleIncrease = useCallback(() => {
    if (level < maxPerLevel && level + other < maxTotal) setLevel(index, level + 1);
  }, [index, level, maxPerLevel, maxTotal, other, setLevel]);

  return (
    <div className="relative flex items-center gap-2">
      <FieldLabel className="absolute right-full w-8 text-[18px] font-semibold">{label}</FieldLabel>
      <Button size="icon" aria-label="Decrease" onClick={handleDecrease}>
        <Minus />
      </Button>
      <span className="flex h-9 w-12 items-center justify-center rounded-md border text-[16px] font-semibold tabular-nums">
        {level}
      </span>
      <Button size="icon" aria-label="Increase" onClick={handleIncrease}>
        <Plus />
      </Button>
    </div>
  );
}

export function Coral({ levels, setLevels, maxTotal, maxPerLevel }: Readonly<CoralProps>) {
  const total = levels.reduce((a, b) => a + b, 0);

  const handleLevelChange = useCallback(
    (i: number, value: number) => {
      setLevels(levels.map((v, j) => (j === i ? value : v)));
    },
    [levels, setLevels],
  );

  return (
    <Field>
      <FieldLabel className="justify-center text-lg font-semibold">Coral</FieldLabel>
      <div className="flex flex-col items-center gap-3">
        {[3, 2, 1, 0].map((i) => (
          <CoralButton
            key={i}
            index={i}
            label={`L${String(i + 1)}`}
            level={levels[i] ?? 0}
            other={total - (levels[i] ?? 0)}
            setLevel={handleLevelChange}
            maxTotal={maxTotal}
            maxPerLevel={maxPerLevel}
          />
        ))}
      </div>
    </Field>
  );
}
