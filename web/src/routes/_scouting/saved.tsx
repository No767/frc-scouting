import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { clear } from "idb-keyval";
import { Bot, Dot, FaceSlightlyFrowning, Flag, MapPin, Skull, Trash2, User } from "lucide-react";
import { useCallback, useState } from "react";

import { Header } from "@/components/app/header";
import { HoldButton } from "@/components/app/hold-button";
import { QRCode } from "@/components/app/qrcode";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  SAVED_MATCHES_STORE,
  savedMatchesQueryOptions,
  savedMatchKey,
  toQrData,
} from "@/routes/_scouting";

export const Route = createFileRoute("/_scouting/saved")({
  component: ScoutingSavedPage,
});

/// Constants

const DELETE_TRIGGER = <Button variant="destructive" />;

/// Route

function ScoutingSavedPage() {
  const queryClient = useQueryClient();
  const { data: saved = [], isSuccess, isError } = useQuery(savedMatchesQueryOptions);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // The dialog closes only once the clear has committed. If it fails, it stays open and the hold
  // button shows deleteStatus "error".
  const { mutate: deleteSavedMatches, status: deleteStatus } = useMutation({
    mutationFn: () => clear(SAVED_MATCHES_STORE),
    onSuccess: () => {
      setDeleteOpen(false);
      return queryClient.invalidateQueries({ queryKey: savedMatchesQueryOptions.queryKey });
    },
    networkMode: "always",
  });
  const handleDeleteSaved = useCallback(() => {
    deleteSavedMatches();
  }, [deleteSavedMatches]);

  const savedLabel = saved.length === 1 ? "1 saved match" : `${String(saved.length)} saved matches`;

  return (
    <Card className="mx-auto w-full max-w-2xl gap-4">
      <Header />
      <CardContent>
        <div className="px-12">
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
          {saved.length > 0 && (
            <div className="text-center">
              <Carousel className="mx-auto w-full max-w-xs">
                <CarouselContent>
                  {saved.map((m) => (
                    <CarouselItem key={savedMatchKey(m.start)}>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xl font-bold">{m.start.eventCode}</span>
                        <span className="flex items-center justify-center gap-1 text-xl font-bold">
                          QM {m.start.matchNumber}
                          <Dot className="size-5" />
                          <Bot className="size-6.5" /> {m.start.team}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-4" /> {m.start.position}
                          <Dot className="size-4" />
                          <User className="size-4" /> {m.start.scouterName}
                        </span>
                        <QRCode value={toQrData(m)} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
              <div className="mt-4">
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogTrigger render={DELETE_TRIGGER}>
                    <Trash2 />
                    Delete all saved matches
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex w-full items-center justify-center gap-2">
                        <Skull className="size-5 shrink-0" /> DANGER
                        <Skull className="size-5 shrink-0" />
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center">
                        Arrr... There's danger afoot. This permanently deletes every saved QR code
                        from this device. It can't be undone. Make sure each match has been scanned
                        into the spreadsheet before you continue.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {" "}
                        <Flag />
                        Return to safety
                      </AlertDialogCancel>
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
