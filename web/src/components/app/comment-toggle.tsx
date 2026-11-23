import { cn } from "cn";
import { useCallback, useState } from "react";

import { ToggleGroupItem } from "@/components/ui/toggle-group";

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
        "h-9 px-2 text-xs data-pressed:bg-primary data-pressed:text-white sm:px-3 sm:text-sm",
        !justClicked && "data-pressed:hover:bg-destructive",
      )}
    >
      {comment}
    </ToggleGroupItem>
  );
}
