import { useFormGroup, useSelector } from "@tanstack/react-form";
import { dehydrate, QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { type Persister } from "@tanstack/react-query-persist-client";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { openDB } from "idb";
import { Bot, Dot, MapPin, User } from "lucide-react";
import { type ChangeEvent, useCallback, useMemo } from "react";
import { z } from "zod";

import { CommentToggle } from "@/components/app/comment-toggle";
import { Header } from "@/components/app/header";
import { HoldButton } from "@/components/app/hold-button";
import { QRCode } from "@/components/app/qrcode";
import { type CoralLevels, Coral } from "@/components/scouting/coral";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  type Step,
  COMMENTS,
  EVENT_CODES,
  POSITIONS,
  startSchema,
  STEPS,
  toQrData,
  useScouting,
} from "@/routes/_scouting";

export const Route = createFileRoute("/_scouting/")({
  component: ScoutingIndexPage,
});

/// Types and Interfaces

type EventCode = (typeof EVENT_CODES)[number]["value"];
type Position = (typeof POSITIONS)[number]["value"];
type MatchRow = z.infer<typeof matchRowSchema>;
type ScheduleDatabase = Record<EventCode, { key: string; value: unknown }>;

interface ScheduleEntry {
  eventCode: EventCode;
  matchKey: string;
  matchRow: MatchRow;
}

interface StepNodeProps {
  value: Step;
  label: string;
  current: boolean;
  disabled: boolean;
  onSelect: (step: Step) => void;
}

/// Constants - stable data

const TEXT_FIELDS = ["start.scouterName", "start.team", "notes"] as const;

const ALLIANCE_POSITIONS: Record<Position, { alliance: keyof MatchRow; position: number }> = {
  R1: { alliance: "red", position: 0 },
  R2: { alliance: "red", position: 1 },
  R3: { alliance: "red", position: 2 },
  B1: { alliance: "blue", position: 0 },
  B2: { alliance: "blue", position: 1 },
  B3: { alliance: "blue", position: 2 },
};

/// Constants - validators

const START_VALIDATORS = { onChange: startSchema };
const SCOUTER_NAME_VALIDATORS = { onMount: startSchema.shape.scouterName };
const MATCH_NUMBER_VALIDATORS = { onMount: startSchema.shape.matchNumber };
const POSITION_VALIDATORS = { onMount: startSchema.shape.position };

const manualTeamSchema = z.string().regex(/^\d+$/u, "Enter a team number.");
const TEAM_VALIDATORS = { onMount: manualTeamSchema, onChange: manualTeamSchema };

/// Constants - IndexedDB related

const SCHEDULE_DATABASE = "tba-schedules";
const SCHEDULE_DATABASE_VERSION = 1;

/// Constants - regular

const TBA_API_URL = "https://www.thebluealliance.com/api/v3";
const TBA_KEY = import.meta.env.VITE_TBA_API_KEY;
const TBA_TIMEOUT_MS = 5000;

/// Tanstack Query keys

const scheduleKeys = {
  all: ["schedule"] as const,
  event: (eventCode: EventCode) => [...scheduleKeys.all, eventCode] as const,
};

/// Zod schemas

const teamNumbersSchema = z.array(z.string());
const matchRowSchema = z.object({ red: teamNumbersSchema, blue: teamNumbersSchema });

const allianceSchema = z
  .object({ team_keys: z.array(z.string().transform((teamKey) => teamKey.replace("frc", ""))) })
  .transform((alliance) => alliance.team_keys);

const scheduleSchema = z.record(z.string(), matchRowSchema);
const tbaScheduleSchema = z
  .array(
    z.object({
      key: z.string().transform((matchKey) => matchKey.slice(matchKey.indexOf("_") + 1)),
      alliances: z.object({ red: allianceSchema, blue: allianceSchema }),
    }),
  )
  .transform((matches) => Object.fromEntries(matches.map((match) => [match.key, match.alliances])));

const savedScheduleSchema = z
  .object({ matchKeys: z.array(z.string()), matchRows: z.array(z.unknown()) })
  .transform((savedSchedule) =>
    Object.fromEntries(
      savedSchedule.matchKeys.map((matchKey, index) => [
        matchKey,
        matchRowSchema.parse(savedSchedule.matchRows[index]),
      ]),
    ),
  );

const savedScheduleQuerySchema = z.object({
  queryKey: z.tuple([z.literal("schedule"), startSchema.shape.eventCode]),
  state: z.object({ data: scheduleSchema }),
});

/// Tanstack Query options

const teamQueryOptions = (
  eventCode: EventCode,
  matchNumber: number | null,
  position: Position | null,
) =>
  queryOptions({
    queryKey: ["schedule", eventCode],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${TBA_API_URL}/event/${eventCode}/matches/simple`, {
        headers: { "X-TBA-Auth-Key": TBA_KEY },
        signal: AbortSignal.any([signal, AbortSignal.timeout(TBA_TIMEOUT_MS)]),
      });
      if (!response.ok) throw new Error(`TBA returned ${String(response.status)}`);

      return tbaScheduleSchema.parse(await response.json());
    },
    select: (schedule) => {
      if (matchNumber === null || position === null) return;
      const team = ALLIANCE_POSITIONS[position];
      return schedule[`qm${String(matchNumber)}`]?.[team.alliance][team.position];
    },
    staleTime: Infinity,
    retryDelay: (attempt) => 500 * 2 ** attempt,
  });

/// Persister

export const schedulePersister: Persister = {
  persistClient: async (client) => {
    const schedules = client.clientState.queries.flatMap((query) => {
      const result = savedScheduleQuerySchema.safeParse(query);
      if (!result.success) return [];
      return [result.data];
    });

    if (schedules.length === 0) return;

    const db = await openDB<ScheduleDatabase>(SCHEDULE_DATABASE);
    const transaction = db.transaction(
      schedules.map((schedule) => schedule.queryKey[1]),
      "readwrite",
    );
    const entries: ScheduleEntry[] = schedules.flatMap((schedule) =>
      Object.entries(schedule.state.data).map(([matchKey, matchRow]) => ({
        eventCode: schedule.queryKey[1],
        matchKey: matchKey,
        matchRow: matchRow,
      })),
    );
    await Promise.all([
      ...entries.map(({ eventCode, matchKey, matchRow }) =>
        transaction.objectStore(eventCode).put(matchRow, matchKey),
      ),
      transaction.done,
    ]);

    db.close();
  },
  restoreClient: async () => {
    const db = await openDB<ScheduleDatabase>(SCHEDULE_DATABASE, SCHEDULE_DATABASE_VERSION, {
      upgrade: (database, oldVersion) => {
        if (oldVersion < 1) {
          for (const event of EVENT_CODES) database.createObjectStore(event.value);
        }
      },
    });
    const transaction = db.transaction(
      EVENT_CODES.map((event) => event.value),
      "readonly",
    );
    const entries = await Promise.all(
      EVENT_CODES.map(async (event) => {
        const store = transaction.objectStore(event.value);
        return {
          eventCode: event.value,
          matchKeys: await store.getAllKeys(),
          matchRows: await store.getAll(),
        };
      }),
    );
    db.close();

    const client = new QueryClient();
    for (const store of entries) {
      if (store.matchKeys.length > 0) {
        client.setQueryData(scheduleKeys.event(store.eventCode), savedScheduleSchema.parse(store));
      }
    }
    return { timestamp: Date.now(), buster: "", clientState: dehydrate(client) };
  },
  removeClient: async () => {
    const db = await openDB<ScheduleDatabase>(SCHEDULE_DATABASE);
    const storeNames = [...db.objectStoreNames];
    if (storeNames.length > 0) {
      const transaction = db.transaction(storeNames, "readwrite");
      await Promise.all([
        ...storeNames.map((storeName) => transaction.objectStore(storeName).clear()),
        transaction.done,
      ]);
    }
    db.close();
  },
};

/// Components

function StepNode({ value, label, current, disabled, onSelect }: Readonly<StepNodeProps>) {
  const handleClick = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <Button
      variant="ghost"
      disabled={disabled}
      aria-current={current ? "step" : undefined}
      onClick={handleClick}
      className="relative h-auto min-h-13 flex-col gap-1 rounded-xl px-0 pt-1.5 pb-1 hover:bg-transparent"
    >
      <span className="flex size-5 items-center justify-center">
        <span
          className={cn(
            "rounded-full",
            current
              ? "size-4 bg-primary ring-4 ring-primary/15"
              : "size-3 border-2 border-muted-foreground bg-background",
          )}
        />
      </span>
      <span className={cn(current ? "font-semibold" : "text-muted-foreground")}>{label}</span>
    </Button>
  );
}

/// Route

function ScoutingIndexPage() {
  const { form, step, setStep, confirmed, setConfirmed, saveStatus } = useScouting();

  const eventCode = useSelector(form.store, (state) => state.values.start.eventCode);
  const matchNumber = useSelector(form.store, (state) => state.values.start.matchNumber);
  const position = useSelector(form.store, (state) => state.values.start.position);

  const { data: team, isLoading } = useQuery(teamQueryOptions(eventCode, matchNumber, position));

  const handleConfirm = useCallback(
    ({ value }: { value: z.input<typeof startSchema> }) => {
      form.setFieldValue("start.team", team ?? value.team);
      setConfirmed(true);
      setStep("auto");
    },
    [team, form, setConfirmed, setStep],
  );
  const startGroup = useFormGroup({
    form,
    name: "start",
    validators: START_VALIDATORS,
    onGroupSubmit: handleConfirm,
  });

  const matchKeyListeners = useMemo(
    () => ({
      onChange: () => {
        form.setFieldValue("start.team", "", { dontUpdateMeta: true });
        setConfirmed(false);
      },
    }),
    [form, setConfirmed],
  );

  const handleConfirmHold = useCallback(() => {
    void startGroup.handleSubmit();
  }, [startGroup]);

  const handleSave = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  const handleText = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      const field = TEXT_FIELDS.find((item) => item === name);
      if (field) form.setFieldValue(field, value);
    },
    [form],
  );

  const handleEventCodeChange = useCallback(
    (value: EventCode | null) => {
      if (value) form.setFieldValue("start.eventCode", value);
    },
    [form],
  );

  const handleMatchNumberChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { valueAsNumber } = event.target;

      // An empty number input reads as NaN, which the form stores as null.
      // oxlint-disable-next-line unicorn/no-null
      form.setFieldValue("start.matchNumber", Number.isNaN(valueAsNumber) ? null : valueAsNumber);
    },
    [form],
  );

  const handlePositionChange = useCallback(
    (value: Position | null) => {
      form.setFieldValue("start.position", value);
    },
    [form],
  );

  const handleAutoCoralChange = useCallback(
    (levels: CoralLevels) => {
      form.setFieldValue("autoCoral", levels);
    },
    [form],
  );

  const handleTeleCoralChange = useCallback(
    (levels: CoralLevels) => {
      form.setFieldValue("teleCoral", levels);
    },
    [form],
  );

  const handleEndgameChange = useCallback(
    (value: string) => {
      form.setFieldValue("endgame", value);
    },
    [form],
  );

  const handleCommentsChange = useCallback(
    (value: string[]) => {
      form.setFieldValue("comments", value);
    },
    [form],
  );

  const enterTeamManually =
    matchNumber !== null && position !== null && !isLoading && team === undefined;
  const teamPlaceholder = isLoading ? "Looking up…" : "Pick an event, match, and position";

  return (
    <Card className="mx-auto w-full max-w-2xl gap-4">
      <Header />
      <CardContent className="flex flex-col gap-5">
        <nav aria-label="Match steps" className="relative grid grid-cols-4">
          <Separator
            aria-hidden
            className="absolute inset-x-[12.5%] top-3.75 rounded-full data-horizontal:h-0.5 data-horizontal:w-auto"
          />
          {STEPS.map(({ value, label }) => (
            <StepNode
              key={value}
              value={value}
              label={label}
              current={value === step}
              disabled={!confirmed && value !== "start"}
              onSelect={setStep}
            />
          ))}
        </nav>
        {step === "start" && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="start.scouterName" validators={SCOUTER_NAME_VALIDATORS}>
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="scouterName">Scouter Name</FieldLabel>
                    <Input
                      id="scouterName"
                      name="start.scouterName"
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value}
                      onChange={handleText}
                    />
                    {field.state.meta.isTouched && !field.state.meta.isValid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field name="start.eventCode" listeners={matchKeyListeners}>
                {(field) => (
                  <Field>
                    <FieldLabel>Event</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={handleEventCodeChange}
                      items={EVENT_CODES}
                    >
                      <SelectTrigger
                        aria-label="Event Code"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "w-auto bg-transparent data-placeholder:text-foreground",
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
                )}
              </form.Field>
              <form.Field
                name="start.matchNumber"
                validators={MATCH_NUMBER_VALIDATORS}
                listeners={matchKeyListeners}
              >
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={"matchNumber"}>Match Number</FieldLabel>
                    <Input
                      id="matchNumber"
                      name="start.matchNumber"
                      type="number"
                      inputMode="numeric"
                      placeholder="Match number"
                      aria-label="Match Number"
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value ?? ""}
                      onChange={handleMatchNumberChange}
                    />
                    {field.state.meta.isTouched && !field.state.meta.isValid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field
                name="start.position"
                validators={POSITION_VALIDATORS}
                listeners={matchKeyListeners}
              >
                {(field) => (
                  <Field>
                    <FieldLabel>Position</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={handlePositionChange}
                      items={POSITIONS}
                    >
                      <SelectTrigger
                        aria-label="Position"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "w-auto bg-transparent data-placeholder:text-foreground",
                          field.state.value &&
                            (field.state.value.startsWith("R")
                              ? "border-destructive/20 bg-destructive/10 text-[color-mix(in_oklch,var(--color-destructive),black_7%)] hover:bg-destructive/20 hover:text-[color-mix(in_oklch,var(--color-destructive),black_7%)] aria-expanded:bg-destructive/20 aria-expanded:text-[color-mix(in_oklch,var(--color-destructive),black_7%)] dark:hover:bg-destructive/20"
                              : "border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:text-blue-600 aria-expanded:bg-blue-500/20 aria-expanded:text-blue-600 dark:hover:bg-blue-500/20"),
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
                )}
              </form.Field>
            </div>
            <div className="mt-6">
              {enterTeamManually ? (
                <form.Field name="start.team" validators={TEAM_VALIDATORS}>
                  {(field) => (
                    <div className="flex flex-col items-center gap-4 rounded-lg border border-foreground/15 p-4">
                      <span className="text-sm text-muted-foreground">Enter Team Manually:</span>
                      <Input
                        name="start.team"
                        inputMode="numeric"
                        placeholder="Team number"
                        aria-label="Team number"
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        value={field.state.value}
                        onChange={handleText}
                      />
                      {field.state.meta.isTouched && !field.state.meta.isValid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </div>
                  )}
                </form.Field>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-lg border border-foreground/15 p-4">
                  {team === undefined ? (
                    <span className="text-center text-3xl font-bold tabular-nums">
                      {teamPlaceholder}
                    </span>
                  ) : (
                    <>
                      <span className="text-base text-muted-foreground md:text-sm">
                        You're Scouting Team:
                      </span>
                      <span className="text-center text-3xl font-bold tabular-nums">{team}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-4">
              <Field className="items-center">
                <FieldLabel className="justify-center">Match Ready?</FieldLabel>
                <HoldButton
                  disabled={confirmed || isLoading || !startGroup.state.meta.canSubmit}
                  onComplete={handleConfirmHold}
                  idleLabel={confirmed ? "Confirmed" : "Hold to confirm"}
                  doneLabel="Confirmed!"
                  status={confirmed ? "success" : "idle"}
                  variant="primary"
                />
              </Field>
            </div>
          </div>
        )}
        {step === "auto" && (
          <form.Field name="autoCoral">
            {(field) => (
              <Coral levels={field.state.value} setLevels={handleAutoCoralChange} maxPerLevel={5} />
            )}
          </form.Field>
        )}
        {step === "tele" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2">
              <form.Field name="teleCoral">
                {(field) => (
                  <Coral
                    levels={field.state.value}
                    setLevels={handleTeleCoralChange}
                    maxPerLevel={12}
                  />
                )}
              </form.Field>
              <Field>
                <FieldLabel className="justify-center text-lg font-semibold">Climb</FieldLabel>
                <div className="flex justify-center">
                  <form.Field name="endgame">
                    {(field) => (
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={handleEndgameChange}
                        className="w-fit"
                      >
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
                    )}
                  </form.Field>
                </div>
              </Field>
            </div>
            <Field>
              <FieldLabel className="justify-center text-lg font-semibold">Comments</FieldLabel>
              <form.Field name="comments">
                {(field) => (
                  <ToggleGroup
                    multiple
                    variant="outline"
                    value={field.state.value}
                    onValueChange={handleCommentsChange}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    {COMMENTS.map((c) => (
                      <CommentToggle key={c} comment={c} />
                    ))}
                  </ToggleGroup>
                )}
              </form.Field>
            </Field>
            <Field>
              <form.Field name="notes">
                {(field) => (
                  <Textarea
                    name="notes"
                    placeholder="Type additional comments here."
                    value={field.state.value}
                    onChange={handleText}
                  />
                )}
              </form.Field>
            </Field>
          </div>
        )}
        {step === "qr" && (
          <form.Subscribe>
            {(state) => (
              <div>
                <div className="flex flex-col items-center gap-2">
                  <span className="flex items-center justify-center gap-1 text-xl font-bold">
                    QM {state.values.start.matchNumber}
                    <Dot className="size-5" />
                    <Bot className="size-6.5" /> {state.values.start.team}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {state.values.start.position}
                    <Dot className="size-4" />
                    <User className="size-4" /> {state.values.start.scouterName}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-4">
                  <QRCode value={toQrData(state.values)} />
                  <HoldButton
                    disabled={!state.canSubmit}
                    onComplete={handleSave}
                    idleLabel="Hold to save QR code"
                    doneLabel="Saved!"
                    failedLabel="Not saved. Your entries are still here, hold to try again"
                    status={saveStatus}
                    variant="primary"
                  />
                  <form.Field name="endgame">
                    {(field) =>
                      !field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />
                    }
                  </form.Field>
                </div>
              </div>
            )}
          </form.Subscribe>
        )}
      </CardContent>
    </Card>
  );
}
