import { type KeyboardEvent, type ReactNode, type RefCallback, useCallback } from "react";

interface LightboxProps {
  children: ReactNode;
  onClose: () => void;
}

export function Lightbox({ children, onClose }: Readonly<LightboxProps>) {
  const focusBackdrop = useCallback<RefCallback<HTMLButtonElement>>((node) => {
    node?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  return (
    <div
      aria-modal="true"
      aria-label="Enlarged QR code"
      className="fixed inset-0 z-100 flex items-center justify-center"
    >
      <button
        ref={focusBackdrop}
        type="button"
        aria-label="Close enlarged QR code"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 cursor-zoom-out bg-black/55 outline-hidden backdrop-blur-sm"
      />
      <div className="pointer-events-none relative size-[92svmin] rounded-[28px] bg-background p-6 shadow-[0px_24px_64px_rgba(0,0,0,0.6)]">
        {children}
      </div>
    </div>
  );
}
