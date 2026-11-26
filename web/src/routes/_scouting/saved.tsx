import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { openDB } from "idb";
import { FaceSlightlyFrowning, MapPin, Trash2, User } from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import beakleLogo from "@/assets/beakle.png";
import { HoldButton } from "@/components/app/hold-button";
import { QRCode } from "@/components/app/qrcode";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { savedMatchesQueryOptions, savedMatchKey, toQrData } from "@/routes/_scouting";

export const Route = createFileRoute("/_scouting/saved")({
  component: ScoutingSavedPage,
});

/// Constants

const DELETE_TRIGGER = (
  <Button
    variant="destructive"
    className={cn(
      "h-11 gap-2 px-5 text-[15px]",
      "sm:max-xl:portrait:h-12 sm:max-xl:portrait:px-6",
      "xl:px-5.5 lg:max-xl:landscape:h-12 lg:max-xl:landscape:px-6",
    )}
  />
);

/// Route

function ScoutingSavedPage() {
  const queryClient = useQueryClient();
  const { data: saved = [], isSuccess, isError } = useQuery(savedMatchesQueryOptions);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [matchPicked, setMatchPicked] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const { mutate: deleteSavedMatches, status: deleteStatus } = useMutation({
    mutationFn: async () => {
      const db = await openDB("saved-matches", undefined, {
        upgrade: (database) => {
          database.createObjectStore("matches");
        },
      });
      await db.clear("matches");
      db.close();
    },
    onSuccess: () => {
      setDeleteOpen(false);
      return queryClient.invalidateQueries({ queryKey: savedMatchesQueryOptions.queryKey });
    },
    networkMode: "always",
  });
  const handleDeleteSaved = useCallback(() => {
    deleteSavedMatches();
  }, [deleteSavedMatches]);

  const handleJump = useCallback(
    (index: number | null) => {
      if (index === null) return;
      setMatchPicked(true);
      carouselApi?.scrollTo(index);
    },
    [carouselApi],
  );

  const subscribeToCarousel = useCallback(
    (onSelect: () => void) => {
      carouselApi?.on("select", onSelect);
      return () => {
        carouselApi?.off("select", onSelect);
      };
    },
    [carouselApi],
  );

  const matchItems = useMemo(
    () =>
      saved.map((match, index) => ({
        key: savedMatchKey(match.start),
        value: index,
        label: `QM ${String(match.start.matchNumber)} · ${match.start.team}`,
      })),
    [saved],
  );

  const selectedIndex = useSyncExternalStore(
    subscribeToCarousel,
    () => carouselApi?.selectedScrollSnap() ?? 0,
  );

  const current = saved.at(selectedIndex);
  const savedLabel = saved.length === 1 ? "1 saved match" : `${String(saved.length)} saved matches`;

  return (
    <div className="flex flex-1 flex-col xl:max-h-svh">
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b px-4",
          "sm:max-xl:portrait:h-17 sm:max-xl:portrait:gap-3.5 sm:max-xl:portrait:px-7",
          "lg:max-xl:landscape:h-16 lg:max-xl:landscape:px-8",
          "xl:h-16 xl:px-10",
          "max-lg:landscape:h-13 max-lg:landscape:px-4",
        )}
      >
        <img
          src={beakleLogo}
          alt="Team 5507"
          className={cn(
            "size-8 rounded-[8px] landscape:hidden",
            "xl:hidden sm:max-xl:portrait:size-10 sm:max-xl:portrait:rounded-[10px]",
          )}
        />
        <span
          className={cn(
            "text-[15px] font-bold text-primary landscape:hidden",
            "xl:hidden sm:max-xl:portrait:text-[17px]",
          )}
        >
          5507 Scouting
        </span>
        <h1
          className={cn(
            "hidden text-[15px] font-semibold landscape:block",
            "xl:block xl:text-lg xl:font-bold lg:max-xl:landscape:text-[17px]",
          )}
        >
          Saved QR Codes
        </h1>
      </header>
      <div
        className={cn(
          "flex flex-1 flex-col items-center gap-5 p-4 before:-order-2 before:-mb-5 before:flex-1 after:-mt-5 after:flex-3",
          "sm:max-xl:portrait:gap-7 sm:max-xl:portrait:p-8 sm:max-xl:portrait:before:-mb-7 sm:max-xl:portrait:after:-mt-7",
          "sm:max-xl:portrait:after:flex-1",
          "lg:max-xl:landscape:flex-row lg:max-xl:landscape:justify-center lg:max-xl:landscape:gap-14",
          "lg:max-xl:landscape:px-10 lg:max-xl:landscape:py-6",
          "lg:max-xl:landscape:before:hidden lg:max-xl:landscape:after:hidden",
          "xl:min-h-0 xl:gap-6 xl:px-10 xl:pt-7 xl:pb-10 xl:before:hidden xl:after:hidden",
          "max-lg:landscape:flex-row max-lg:landscape:flex-wrap max-lg:landscape:content-center max-lg:landscape:items-start",
          "max-lg:landscape:justify-center max-lg:landscape:gap-8 max-lg:landscape:px-6 max-lg:landscape:py-3",
          "max-lg:landscape:before:hidden max-lg:landscape:after:hidden",
        )}
      >
        {isError && (
          <p className="text-center text-sm text-destructive">
            Couldn't read saved matches on this device.
          </p>
        )}
        {isSuccess && saved.length === 0 && (
          <span className="flex items-center justify-center gap-1 text-xl font-bold">
            No QR codes saved
            <FaceSlightlyFrowning />
          </span>
        )}
        {current && (
          <>
            <Carousel
              setApi={setCarouselApi}
              className={cn(
                "w-66 shrink-0 rounded-[24px] border bg-background p-4 shadow-[0_1px_2px_rgb(12_10_9/0.04),0_8px_24px_rgb(12_10_9/0.06)]",
                "sm:rounded-[28px] sm:p-6 sm:max-xl:portrait:w-122.5",
                "xl:aspect-square xl:max-h-122.5 xl:min-h-0 xl:w-auto xl:flex-1 lg:max-xl:landscape:w-127.5",
                "max-lg:landscape:w-66.5 max-lg:landscape:rounded-[20px] max-lg:landscape:p-3.5",
              )}
            >
              <CarouselContent>
                {saved.map((match) => (
                  <CarouselItem key={savedMatchKey(match.start)}>
                    <QRCode value={toQrData(match)} className="max-w-none" />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                className={cn(
                  "xl:-left-14 sm:max-xl:portrait:-left-14 lg:max-xl:landscape:-left-14",
                  "max-lg:landscape:-left-11.5",
                )}
              />
              <CarouselNext
                className={cn(
                  "xl:-right-14 sm:max-xl:portrait:-right-14 lg:max-xl:landscape:-right-14",
                  "max-lg:landscape:-right-11.5",
                )}
              />
            </Carousel>
            <div
              className={cn(
                "contents",
                "lg:max-xl:landscape:flex lg:max-xl:landscape:w-75 lg:max-xl:landscape:flex-col",
                "lg:max-xl:landscape:items-center lg:max-xl:landscape:gap-7 lg:max-xl:landscape:pb-7",
                "max-lg:landscape:flex max-lg:landscape:w-70 max-lg:landscape:flex-col",
                "max-lg:landscape:items-center max-lg:landscape:gap-5",
              )}
            >
              <Select
                items={matchItems}
                // Required by Base UI
                // oxlint-disable-next-line unicorn/no-null
                value={matchPicked ? selectedIndex : null}
                onValueChange={handleJump}
              >
                <SelectTrigger
                  aria-label="Jump to a saved match"
                  className={cn(
                    "order-first w-full rounded-full bg-muted px-4 pr-3.5 text-[15px] font-medium text-stone-600 data-[size=default]:h-11",
                    "sm:max-xl:portrait:max-w-150.5 sm:max-xl:portrait:text-base sm:max-xl:portrait:data-[size=default]:h-12",
                    "lg:max-xl:landscape:mb-7 lg:max-xl:landscape:text-base lg:max-xl:landscape:data-[size=default]:h-12",
                    "xl:max-w-150.5",
                  )}
                >
                  <SelectValue placeholder="Jump to match" className="tabular-nums" />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  sideOffset={6}
                  className={cn(
                    "max-h-[min(var(--available-height),22.5rem)]",
                    "sm:max-xl:portrait:max-h-[min(var(--available-height),26.25rem)]",
                    "xl:max-h-[min(var(--available-height),26.25rem)]",
                    "max-lg:landscape:max-h-[min(var(--available-height),12.5rem)]",
                  )}
                >
                  <SelectGroup className="p-2">
                    {matchItems.map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.value}
                        className={cn(
                          "py-2.5 pr-9 text-[15px] tabular-nums data-selected:bg-foreground/8",
                          "sm:max-xl:portrait:text-base lg:max-xl:landscape:text-base",
                        )}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="-order-1 flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "text-xl font-bold",
                    "sm:max-xl:portrait:text-[22px] lg:max-xl:landscape:text-[22px]",
                  )}
                >
                  {current.start.eventCode}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-2 text-xl font-bold tabular-nums",
                    "sm:max-xl:portrait:text-[22px] lg:max-xl:landscape:text-[22px]",
                  )}
                >
                  QM {current.start.matchNumber}
                  <span aria-hidden className="size-1.25 rounded-full bg-foreground" />
                  {current.start.team}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm text-muted-foreground",
                    "sm:max-xl:portrait:text-[15px] lg:max-xl:landscape:text-[15px]",
                  )}
                >
                  <MapPin className="size-3.75" /> {current.start.position}
                  <span aria-hidden className="size-1 rounded-full bg-muted-foreground" />
                  <User className="size-3.75" /> {current.start.scouterName}
                </span>
              </div>
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger render={DELETE_TRIGGER}>
                  <Trash2 />
                  Delete all saved matches
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                      <Trash2 />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete all saved matches?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes every saved QR code on this device, and it can't be
                      undone. Ensure that each match has been scanned into the spreadsheet first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex sm:flex-col-reverse">
                    <AlertDialogCancel className="h-11 gap-2">Cancel</AlertDialogCancel>
                    <HoldButton
                      variant="destructive"
                      idleLabel={`Hold to delete ${savedLabel}`}
                      doneLabel="Deleted"
                      failedLabel="Not deleted. Hold to try again"
                      status={deleteStatus}
                      onComplete={handleDeleteSaved}
                    />
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
