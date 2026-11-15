import { createFileRoute } from "@tanstack/react-router";
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
import { readSavedMatches, SAVED_MATCHES_KEY } from "@/routes/_scouting";

export const Route = createFileRoute("/_scouting/saved")({
  component: ScoutingSavedPage,
});

/// Constants

const DELETE_TRIGGER = <Button variant="destructive" />;

/// Route

function ScoutingSavedPage() {
  const [saved, setSaved] = useState(readSavedMatches);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteSaved = useCallback(() => {
    localStorage.removeItem(SAVED_MATCHES_KEY);
    setSaved([]);
    setDeleteOpen(false);
  }, []);

  const savedLabel = saved.length === 1 ? "1 saved match" : `${String(saved.length)} saved matches`;

  return (
    <Card className="mx-auto w-full max-w-2xl gap-4">
      <Header />
      <CardContent>
        <div className="px-12">
          {saved.length === 0 ? (
            <span className="flex items-center justify-center gap-1 text-xl font-bold">
              No QR codes saved
              <FaceSlightlyFrowning />
            </span>
          ) : (
            <div className="text-center">
              <Carousel className="mx-auto w-full max-w-xs">
                <CarouselContent>
                  {saved.map((m) => {
                    const [event, match, pos] = m.key.split("_");
                    return (
                      <CarouselItem key={m.key}>
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xl font-bold">{event}</span>
                          <span className="flex items-center justify-center gap-1 text-xl font-bold">
                            QM {match?.replace("qm", "")}
                            <Dot className="size-5" />
                            <Bot className="size-6.5" /> {m.team}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="size-4" /> {pos}
                            <Dot className="size-4" />
                            <User className="size-4" /> {m.scouter}
                          </span>
                          <QRCode value={m.qrData} />
                        </div>
                      </CarouselItem>
                    );
                  })}
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
