import { cn } from "cn";
import { useCallback, useState } from "react";

import { ToggleGroupItem } from "@/components/ui/toggle-group";

export const COMMENTS = [
  "Not on Field",
  "Stopped Moving",
  "Dead <45s",
  "Dead >45s",
  "Floor Pickup Algae",
  "Floor Pickup Coral",
  "Holds Both Game Pieces",
  "Slow Drive",
  "Fast Drive",
  "Bad Driving",
  "Good Driving",
  "Drops Game Pieces",
  "Lots of Fouls",
  "Tipped",
  "Didn't Move",
  "Broken",
  "Played Defense",
  "Received Defense",
  "Yellow Card",
];

interface CommentToggleProps {
  comment: string;
}

export function CommentToggle({ comment }: Readonly<CommentToggleProps>) {
  const [justClicked, setJustClicked] = useState(false);

  const handleClick = useCallback(() => {
    setJustClicked(true);
  }, []);
  const handlePointerLeave = useCallback(() => {
    setJustClicked(false);
  }, []);

  return (
    <ToggleGroupItem
      value={comment}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "h-7 px-2 text-xs data-pressed:bg-primary data-pressed:text-white sm:h-8 sm:px-3 sm:text-sm",
        !justClicked && "data-pressed:hover:bg-destructive",
      )}
    >
      {comment}
    </ToggleGroupItem>
  );
}
