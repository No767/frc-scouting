import { ClearCache } from "./clear-cache";
import { COMMENTS, CommentToggle } from "./comment-toggle";
import { Coral } from "./coral";
import { HoldButton } from "./hold-button";
import { QualMatch } from "./icon";

import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Bot, Dot, FaceSlightlyFrowning, MapPin, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type ChangeEvent, useCallback, useState } from "react";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { BrandHeader } from "@/features/brand-header";
import { TextField } from "@/features/text-field";

/// Types and Interfaces

type EventCode = (typeof EVENT_CODES)[number]["value"];
type Position = (typeof POSITIONS)[number]["value"];
type SavedMatch = z.infer<typeof savedMatchSchema>;

/// Constants

const TBA_API_URL = "https://www.thebluealliance.com/api/v3";
const TBA_KEY = import.meta.env.VITE_TBA_API_KEY;
const TBA_TIMEOUT_MS = 5000;
const SAVED_MATCHES_KEY = "savedMatches";

const EVENT_CODES = [
  { value: "2026cacac", label: "Contra Costa" },
  { value: "2027casnf", label: "San Francisco" },
  { value: "2027caetb", label: "East Bay" },
  { value: "2027cancmp", label: "NorCal DCMP" },
] as const;

const POSITIONS = [
  { value: "R1", label: "R1" },
  { value: "R2", label: "R2" },
  { value: "R3", label: "R3" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "B3", label: "B3" },
] as const;

const QR_IMAGE = {
  src: "https://bicmztrblwpucysepkoq.supabase.co/storage/v1/object/public/images/Beakle.png",
  height: 70,
  width: 70,
  excavate: true,
};

/// Zod schemas

const allianceSchema = z.object({
  team_keys: z.array(z.string()),
});

const tbaMatchSchema = z.object({
  alliances: z.object({
    red: allianceSchema,
    blue: allianceSchema,
  }),
});

const savedMatchSchema = z.object({
  scouter: z.string(),
  key: z.string(),
  team: z.string(),
  qrData: z.string(),
  savedAt: z.number(),
});

/// Tanstack Query options

const teamQueryOptions = (
  eventCode: EventCode | null,
  matchNumber: string,
  position: Position | null,
) =>
  queryOptions({
    queryKey: ["teams", eventCode, matchNumber, position],
    queryFn:
      eventCode && matchNumber && position
        ? async ({ signal }) => {
            const res = await fetch(`${TBA_API_URL}/match/${eventCode}_qm${matchNumber}`, {
              headers: { "X-TBA-Auth-Key": TBA_KEY },
              signal: AbortSignal.any([signal, AbortSignal.timeout(TBA_TIMEOUT_MS)]),
            });
            if (!res.ok) throw new Error(`TBA returned ${String(res.status)}`);

            const match = tbaMatchSchema.parse(await res.json());
            const alliance = position.startsWith("R") ? "red" : "blue";
            const teamKey = match.alliances[alliance].team_keys[Number(position.slice(1)) - 1];
            if (teamKey === undefined) throw new Error(`TBA has no team at ${position}`);

            return teamKey.replace("frc", "");
          }
        : skipToken,
    // A failed lookup falls back to manual entry, so it needs to fail fast rather than retry
    retry: false,
    // Venues often have no connection; the default mode would pause here instead of failing
    networkMode: "always",
  });

/// Component

export function ScoutingForm() {
  const [tab, setTab] = useState<"start" | "auto" | "tele" | "qr" | "saved">("start");
  const [scouterName, setScouterName] = useState("");
  const [eventCode, setEventCode] = useState<EventCode | null>("2026cacac");
  const [matchNumber, setMatchNumber] = useState("");
  // Base UI's Select uses null for "no selection"; undefined would make it uncontrolled
  // oxlint-disable-next-line unicorn/no-null
  const [position, setPosition] = useState<Position | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Keyed by match so a hand-typed team can't carry over to the next match
  const [manualEntry, setManualEntry] = useState({ key: "", team: "" });

  const {
    data: fetchedTeam,
    isError,
    isLoading,
  } = useQuery(teamQueryOptions(eventCode, matchNumber, position));

  const matchKey = eventCode && position ? `${eventCode}_qm${matchNumber}_${position}` : "";
  const team = fetchedTeam ?? (manualEntry.key === matchKey ? manualEntry.team : "");
  const lookupFailed = isError && fetchedTeam === undefined;

  const matchReady = Boolean(scouterName && eventCode && matchNumber && position && team);
  const canConfirm = matchReady && !isLoading;
  // Rechecked after confirming so clearing a Start field can't save a QR code missing its match
  const tabsLocked = !confirmed || !matchReady;

  const [autoCoral, setAutoCoral] = useState([0, 0, 0, 0]);
  const [teleCoral, setTeleCoral] = useState([0, 0, 0, 0]);

  const [endgame, setEndgame] = useState("");

  const [comments, setComments] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  let message: string;
  if (isLoading) message = "Looking up…";
  else if (team) message = team;
  else message = "Pick an event, match, and position";

  const [saved, setSaved] = useState<SavedMatch[]>(() => {
    // Validated per entry so one bad entry can't discard every unscanned match on this device
    try {
      const stored = z
        .array(z.unknown())
        .parse(JSON.parse(localStorage.getItem(SAVED_MATCHES_KEY) ?? "[]"));
      return stored.flatMap((entry) => {
        const result = savedMatchSchema.safeParse(entry);
        return result.success ? [result.data] : [];
      });
    } catch {
      return [];
    }
  });

  const qrData = [
    eventCode,
    matchNumber,
    position,
    team,
    scouterName,
    ...autoCoral,
    ...teleCoral,
    endgame,
    ...COMMENTS.map((c) => (comments.includes(c) ? 1 : 0)),
    notes.replaceAll(/[\t\n]/gu, " "),
  ].join("\t");

  const isSaved = saved.some((m) => m.key === matchKey && m.qrData === qrData);

  const handleSave = useCallback(() => {
    const newEntry: SavedMatch = {
      scouter: scouterName,
      key: matchKey,
      team,
      qrData,
      savedAt: Date.now(),
    };
    const nextSaved = [newEntry, ...saved.filter((m) => m.key !== newEntry.key)];
    // Written first so a failed write can't show a match as saved when it isn't
    localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(nextSaved));
    setSaved(nextSaved);
  }, [matchKey, qrData, saved, scouterName, team]);

  const resetKeepMatchNumber = useCallback(() => {
    setAutoCoral([0, 0, 0, 0]);
    setTeleCoral([0, 0, 0, 0]);
    setEndgame("");
    setComments([]);
    setConfirmed(false);
    setTab("start");
    setNotes("");
  }, []);

  const handleReset = useCallback(() => {
    resetKeepMatchNumber();
    setMatchNumber((m) => String(Number(m) + 1));
  }, [resetKeepMatchNumber]);

  const handleConfirm = useCallback(() => {
    resetKeepMatchNumber();
    setConfirmed(true);
    setTab("auto");
  }, [resetKeepMatchNumber]);

  const handleMatchNumberChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMatchNumber(event.target.value);
  }, []);

  const handleTeamChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setManualEntry({ key: matchKey, team: event.target.value });
    },
    [matchKey],
  );

  const handleNotesChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(event.target.value);
  }, []);

  const handleDeleteSaved = useCallback(() => {
    localStorage.removeItem(SAVED_MATCHES_KEY);
    setSaved([]);
  }, []);

  return (
    <Card className="mx-auto w-full max-w-2xl gap-4">
      <BrandHeader
        title={"FRC 5507 Scouting Form"}
        description={"Generate a scouting data QR code."}
      />
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mx-auto">
            <TabsTrigger value="start">Start</TabsTrigger>
            <TabsTrigger value="auto" disabled={tabsLocked}>
              Auto
            </TabsTrigger>
            <TabsTrigger value="tele" disabled={tabsLocked}>
              Teleop
            </TabsTrigger>
            <TabsTrigger value="qr" disabled={tabsLocked}>
              QR
            </TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>
          <TabsContent value="start">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="scouterName"
                label="Scouter Name"
                value={scouterName}
                onChange={setScouterName}
              />
              <Field>
                <FieldLabel>Event</FieldLabel>
                <Select value={eventCode} onValueChange={setEventCode} items={EVENT_CODES}>
                  <SelectTrigger
                    aria-label="Event Code"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "w-auto bg-transparent data-placeholder:text-foreground",
                      eventCode !== null &&
                        "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary aria-expanded:bg-primary/20 aria-expanded:text-primary dark:hover:bg-primary/20",
                    )}
                  >
                    <SelectValue placeholder="Select Event" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CODES.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={"matchNumber"}>Match Number</FieldLabel>
                <Input
                  id="matchNumber"
                  inputMode="numeric"
                  placeholder="Match number"
                  aria-label="Match Number"
                  value={matchNumber}
                  onChange={handleMatchNumberChange}
                />
              </Field>
              <Field>
                <FieldLabel>Position</FieldLabel>
                <Select value={position} onValueChange={setPosition} items={POSITIONS}>
                  <SelectTrigger
                    aria-label="Position"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "w-auto bg-transparent data-placeholder:text-foreground",
                      position &&
                        (position.startsWith("R")
                          ? "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive aria-expanded:bg-destructive/20 aria-expanded:text-destructive dark:hover:bg-destructive/20"
                          : "border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 aria-expanded:bg-blue-500/20 aria-expanded:text-blue-500 dark:hover:bg-blue-500/20"),
                    )}
                  >
                    <SelectValue placeholder="Select Position" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-6">
              {lookupFailed ? (
                <div className="flex flex-col items-center gap-4 rounded-lg border p-4">
                  <span className="text-sm text-muted-foreground">Enter Team Manually:</span>
                  <Input
                    inputMode="numeric"
                    placeholder="Team number"
                    aria-label="Team number"
                    value={team}
                    onChange={handleTeamChange}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-lg border p-4">
                  <span className="text-base text-muted-foreground md:text-sm">
                    You're Scouting Team:
                  </span>
                  <span className="text-center text-3xl font-bold tabular-nums">{message}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-4">
              <Field className="items-center">
                <FieldLabel className="justify-center">Match Ready?</FieldLabel>
                <HoldButton
                  disabled={!canConfirm}
                  onComplete={handleConfirm}
                  idleLabel="Hold to confirm"
                  doneLabel="Confirmed!"
                  variant="primary"
                />
              </Field>
            </div>
          </TabsContent>
          <TabsContent value="auto">
            <Coral levels={autoCoral} setLevels={setAutoCoral} maxTotal={5} maxPerLevel={5} />
          </TabsContent>
          <TabsContent value="tele" className="flex flex-col gap-4">
            <div className="grid grid-cols-2">
              <Coral levels={teleCoral} setLevels={setTeleCoral} maxTotal={25} maxPerLevel={12} />
              <Field>
                <FieldLabel className="justify-center text-lg font-semibold">Climb</FieldLabel>
                <div className="flex justify-center">
                  <RadioGroup value={endgame} onValueChange={setEndgame} className="w-fit">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="no_attempt" id="r1" />
                      <Label htmlFor="r1">No Attempt</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="park" id="r2" />
                      <Label htmlFor="r2">Park w/o Attempt</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="shallow_fail" id="r3" />
                      <Label htmlFor="r3">Shallow Attempt w/ Fail</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="shallow_success" id="r4" />
                      <Label htmlFor="r4">Shallow Success</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="deep_fail" id="r5" />
                      <Label htmlFor="r5">Deep Attempt w/Fail</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="deep_success" id="r6" />
                      <Label htmlFor="r6">Deep Success</Label>
                    </div>
                  </RadioGroup>
                </div>
              </Field>
            </div>
            <Field>
              <FieldLabel className="justify-center text-lg font-semibold">Comments</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                value={comments}
                onValueChange={setComments}
                className="flex flex-wrap justify-center gap-2"
              >
                {COMMENTS.map((c) => (
                  <CommentToggle key={c} comment={c} />
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <Textarea
                placeholder="Type additional comments here."
                value={notes}
                onChange={handleNotesChange}
              />
            </Field>
          </TabsContent>
          <TabsContent value="qr">
            <div className="flex flex-col items-center gap-2">
              <span className="flex items-center justify-center gap-1 text-xl font-bold">
                <QualMatch className="size-8" /> {matchNumber}
                <Dot className="size-5" />
                <Bot className="size-6.5" /> {team}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {position}
                <Dot className="size-4" />
                <User className="size-4" /> {scouterName}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-4">
              <QRCodeSVG
                value={qrData}
                size={300}
                level="H"
                imageSettings={QR_IMAGE}
                className="mx-auto h-auto w-full max-w-xs [&_image]:[clip-path:inset(0_round_2px)]"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleSave} disabled={!endgame}>
                  {endgame ? "Save QR Code" : "Pick climb to enable"}
                </Button>
                <HoldButton
                  disabled={!isSaved}
                  onComplete={handleReset}
                  idleLabel="Hold to reset"
                  doneLabel="Reset!"
                  variant="destructive"
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="saved">
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
                                <QualMatch className="size-8" /> {match?.replace("qm", "")}
                                <Dot className="size-5" />
                                <Bot className="size-6.5" /> {m.team}
                              </span>
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="size-4" /> {pos}
                                <Dot className="size-4" />
                                <User className="size-4" /> {m.scouter}
                              </span>
                              <QRCodeSVG
                                value={m.qrData}
                                size={300}
                                level="H"
                                imageSettings={QR_IMAGE}
                                className="mx-auto h-auto w-full max-w-xs [&_image]:[clip-path:inset(0_round_2px)]"
                              />
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                  <div className="mt-4">
                    <ClearCache count={saved.length} onDelete={handleDeleteSaved} />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
