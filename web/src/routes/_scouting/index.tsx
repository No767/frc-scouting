import { useFormGroup, useSelector } from "@tanstack/react-form";
import { dehydrate, QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { type Persister } from "@tanstack/react-query-persist-client";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { openDB } from "idb";
import { ChevronDown, MapPin, User } from "lucide-react";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { z } from "zod";

import beakleLogo from "@/assets/beakle.png";
import { CommentToggle } from "@/components/app/comment-toggle";
import { HoldButton } from "@/components/app/hold-button";
import { QRCode } from "@/components/app/qrcode";
import { type CoralLevels, Coral } from "@/components/scouting/coral";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  past: boolean;
  last: boolean;
  disabled: boolean;
  onSelect: (step: Step) => void;
}

/// Constants - stable data

const TEXT_FIELDS = ["start.scouterName", "start.team", "notes"] as const;

const CLIMBS = [
  { value: "no_attempt", label: "No Attempt", shortLabel: "No Attempt" },
  { value: "park", label: "Park w/o Attempt", shortLabel: "Park w/o Attempt" },
  { value: "shallow_fail", label: "Shallow Attempt w/ Fail", shortLabel: "Shallow w/ Fail" },
  { value: "shallow_success", label: "Shallow Success", shortLabel: "Shallow Success" },
  { value: "deep_fail", label: "Deep Attempt w/ Fail", shortLabel: "Deep w/ Fail" },
  { value: "deep_success", label: "Deep Success", shortLabel: "Deep Success" },
] as const;

const ALLIANCE_CLASSES = {
  red: "border-destructive/20 bg-destructive/10 text-[color-mix(in_oklch,var(--color-destructive),black_7%)]",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-600",
};

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

function StepNode({
  value,
  label,
  current,
  past,
  last,
  disabled,
  onSelect,
}: Readonly<StepNodeProps>) {
  const handleClick = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <Button
      variant="ghost"
      disabled={disabled}
      aria-current={current ? "step" : undefined}
      onClick={handleClick}
      className={cn(
        "relative h-auto flex-col gap-1.5 rounded-xl p-0 text-sm font-normal hover:bg-transparent disabled:opacity-100",
        "sm:gap-2 sm:text-[15px] max-lg:landscape:gap-1.5 max-lg:landscape:text-[13px]",
      )}
    >
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute top-2 -right-1/2 left-1/2 mx-4 h-0.75 -translate-y-1/2 rounded-full",
            "sm:mx-4.5 max-lg:landscape:mx-4",
            past ? "bg-primary" : "bg-border",
          )}
        />
      )}
      <span className="flex size-4 items-center justify-center">
        <span
          className={cn(
            "rounded-full",
            current && "size-4 bg-primary ring-4 ring-primary/15",
            past && "size-3 bg-primary",
            !current && !past && "size-3 border-2 border-stone-400 bg-background",
          )}
        />
      </span>
      <span
        className={cn(
          current && "font-semibold text-foreground",
          past && "text-stone-600",
          !current && !past && (disabled ? "text-stone-400" : "text-muted-foreground"),
        )}
      >
        {label}
      </span>
    </Button>
  );
}

/// Route

function ScoutingIndexPage() {
  const { form, step, setStep, confirmed, setConfirmed, saveStatus } = useScouting();

  const eventCode = useSelector(form.store, (state) => state.values.start.eventCode);
  const matchNumber = useSelector(form.store, (state) => state.values.start.matchNumber);
  const position = useSelector(form.store, (state) => state.values.start.position);
  const confirmedTeam = useSelector(form.store, (state) => state.values.start.team);

  const [commentsOpen, setCommentsOpen] = useState(false);

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

  const stepIndex = STEPS.findIndex((item) => item.value === step);
  const enterTeamManually =
    matchNumber !== null && position !== null && !isLoading && team === undefined;
  const teamPlaceholder = isLoading ? "Looking up…" : "Pick an event, match, and position";

  return (
    <div className="flex flex-1 flex-col">
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b px-4",
          "sm:max-xl:portrait:h-17 sm:max-xl:portrait:gap-3.5 sm:max-xl:portrait:px-7",
          "lg:max-xl:landscape:h-16 lg:max-xl:landscape:justify-end lg:max-xl:landscape:px-8",
          "xl:h-16 xl:gap-3 xl:px-10",
          "max-lg:landscape:h-13 max-lg:landscape:justify-end max-lg:landscape:px-4",
          !confirmed && "xl:hidden landscape:hidden",
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
        {confirmed ? (
          <>
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5",
                "max-lg:landscape:flex-none lg:max-xl:landscape:flex-none",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[15px] font-bold tabular-nums",
                  "sm:max-xl:portrait:gap-2 sm:max-xl:portrait:text-[17px]",
                  "xl:gap-2 xl:text-lg max-lg:landscape:text-sm lg:max-xl:landscape:hidden",
                )}
              >
                QM {matchNumber}
                <span
                  aria-hidden
                  className={cn(
                    "size-1 rounded-full bg-foreground",
                    "xl:size-1.25 sm:max-xl:portrait:size-1.25",
                  )}
                />
                {confirmedTeam}
              </span>
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  "xl:text-[13px] sm:max-xl:portrait:text-[13px] lg:max-xl:landscape:text-sm",
                  "max-lg:landscape:hidden",
                )}
              >
                {EVENT_CODES.find((event) => event.value === eventCode)?.label}
              </span>
            </div>
            {position && (
              <span
                className={cn(
                  "flex h-7 items-center rounded-full border px-3 text-[13px] font-bold",
                  "sm:max-xl:portrait:h-8.5 sm:max-xl:portrait:px-3.5 sm:max-xl:portrait:text-sm",
                  "xl:h-8.5 xl:px-3.5 xl:text-sm lg:max-xl:landscape:hidden",
                  "max-lg:landscape:h-6.5 max-lg:landscape:px-2.5 max-lg:landscape:text-xs",
                  position.startsWith("R") ? ALLIANCE_CLASSES.red : ALLIANCE_CLASSES.blue,
                )}
              >
                {position}
              </span>
            )}
          </>
        ) : (
          <span className="text-[15px] font-bold text-primary">5507 Scouting</span>
        )}
      </header>
      <nav
        aria-label="Match steps"
        className={cn(
          "grid shrink-0 grid-cols-4 px-3 pt-5.5 pb-3.5",
          "sm:mx-auto sm:w-150 sm:max-w-full sm:px-0 sm:pt-7 sm:pb-4.5",
          "max-lg:landscape:mx-auto max-lg:landscape:w-120 max-lg:landscape:px-0 max-lg:landscape:pt-4.5 max-lg:landscape:pb-2.5",
        )}
      >
        {STEPS.map(({ value, label }, index) => (
          <StepNode
            key={value}
            value={value}
            label={label}
            current={value === step}
            past={index < stepIndex}
            last={index === STEPS.length - 1}
            disabled={!confirmed && value !== "start"}
            onSelect={setStep}
          />
        ))}
      </nav>
      {step === "start" && (
        <>
          <div
            className={cn(
              "flex w-full flex-1 flex-col gap-4 px-5 pt-3 pb-5",
              "sm:mx-auto sm:max-w-195 sm:px-6",
            )}
          >
            <span className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
              Match setup
            </span>
            <form.Field name="start.scouterName" validators={SCOUTER_NAME_VALIDATORS}>
              {(field) => (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="scouterName">Scouter Name</FieldLabel>
                  <Input
                    id="scouterName"
                    name="start.scouterName"
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    value={field.state.value}
                    onChange={handleText}
                    className="h-11 rounded-full px-4 md:text-[15px]"
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
                </Field>
              )}
            </form.Field>
            <form.Field name="start.eventCode" listeners={matchKeyListeners}>
              {(field) => (
                <Field className="gap-1.5">
                  <FieldLabel>Event</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={handleEventCodeChange}
                    items={EVENT_CODES}
                  >
                    <SelectTrigger
                      aria-label="Event Code"
                      className="w-full rounded-full border-primary/20 bg-primary/10 px-4 text-[15px] font-medium text-primary hover:bg-primary/20 aria-expanded:bg-primary/20 data-[size=default]:h-11 [&>svg]:text-current"
                    >
                      <SelectValue placeholder="Select Event" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup className="p-2">
                        {EVENT_CODES.map((event) => (
                          <SelectItem
                            key={event.value}
                            value={event.value}
                            className="py-2.5 pr-9 text-[15px]"
                          >
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-3">
              <form.Field
                name="start.matchNumber"
                validators={MATCH_NUMBER_VALIDATORS}
                listeners={matchKeyListeners}
              >
                {(field) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="matchNumber">Match Number</FieldLabel>
                    <Input
                      id="matchNumber"
                      name="start.matchNumber"
                      type="number"
                      inputMode="numeric"
                      placeholder="Match number"
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      value={field.state.value ?? ""}
                      onChange={handleMatchNumberChange}
                      className={cn(
                        "h-11 rounded-full px-4 md:text-[15px]",
                        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                      )}
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
                  <Field className="gap-1.5">
                    <FieldLabel>Position</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={handlePositionChange}
                      items={POSITIONS}
                    >
                      <SelectTrigger
                        aria-label="Position"
                        className={cn(
                          "w-full rounded-full px-4 text-[15px] font-semibold data-placeholder:font-normal data-[size=default]:h-11 [&>svg]:text-current",
                          field.state.value &&
                            (field.state.value.startsWith("R")
                              ? cn(
                                  ALLIANCE_CLASSES.red,
                                  "hover:bg-destructive/20 aria-expanded:bg-destructive/20",
                                )
                              : cn(
                                  ALLIANCE_CLASSES.blue,
                                  "hover:bg-blue-500/20 aria-expanded:bg-blue-500/20",
                                )),
                        )}
                      >
                        <SelectValue placeholder="Select Position" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup className="p-2">
                          {POSITIONS.map((event) => (
                            <SelectItem
                              key={event.value}
                              value={event.value}
                              className="py-2.5 pr-9 text-[15px]"
                            >
                              {event.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>
            <div className="mt-2">
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
                        className="h-11 rounded-full px-4 md:text-[15px]"
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
                      <span className="text-base text-muted-foreground">You're Scouting Team:</span>
                      <span className="text-center text-3xl font-bold tabular-nums">{team}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 border-t px-5 pt-3 pb-3.5 sm:px-6">
            <div className="mx-auto flex max-w-183 flex-col gap-2">
              <span className="text-center text-[13px] text-stone-600">Match ready?</span>
              <HoldButton
                disabled={confirmed || isLoading || !startGroup.state.meta.canSubmit}
                onComplete={handleConfirmHold}
                idleLabel={confirmed ? "Confirmed" : "Hold to confirm"}
                doneLabel="Confirmed!"
                status={confirmed ? "success" : "idle"}
                variant="primary"
                className="h-13 w-full text-base font-semibold"
              />
            </div>
          </div>
        </>
      )}
      {step === "auto" && (
        <div
          className={cn(
            "w-full px-4 pt-2.5 pb-4",
            "sm:mx-auto sm:max-w-87.5 sm:px-0 sm:pt-5 sm:pb-6",
            "max-lg:landscape:mx-auto max-lg:landscape:max-w-87.5 max-lg:landscape:px-0 max-lg:landscape:pt-3",
          )}
        >
          <form.Field name="autoCoral">
            {(field) => (
              <Coral levels={field.state.value} setLevels={handleAutoCoralChange} maxPerLevel={5} />
            )}
          </form.Field>
        </div>
      )}
      {step === "tele" && (
        <div
          className={cn(
            "flex w-full flex-col gap-3 px-4 pt-2.5 pb-4",
            "sm:mx-auto sm:max-w-195 sm:gap-8 sm:px-6 sm:pt-5 sm:pb-6",
            "xl:mx-0 xl:max-w-none xl:gap-6 xl:px-10 xl:pt-2 xl:pb-6",
            "max-lg:landscape:max-w-none max-lg:landscape:gap-0 max-lg:landscape:px-4 max-lg:landscape:pt-3 max-lg:landscape:pb-4",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-3",
              "sm:grid sm:grid-cols-2 sm:gap-8 xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]",
              "max-lg:landscape:grid max-lg:landscape:grid-cols-2 max-lg:landscape:items-start max-lg:landscape:gap-5",
            )}
          >
            <form.Field name="teleCoral">
              {(field) => (
                <Coral
                  levels={field.state.value}
                  setLevels={handleTeleCoralChange}
                  maxPerLevel={12}
                />
              )}
            </form.Field>
            <section
              aria-label="Climb"
              className={cn(
                "flex flex-col gap-3 pt-2",
                "sm:gap-2.5 sm:pt-0 max-lg:landscape:gap-1.5 max-lg:landscape:pt-0",
              )}
            >
              <div
                className={cn(
                  "flex items-baseline px-1",
                  "sm:h-7 sm:px-0 max-lg:landscape:h-5.5 max-lg:landscape:px-0",
                )}
              >
                <h2 className="text-lg font-semibold max-lg:landscape:text-[15px]">Climb</h2>
              </div>
              <form.Field name="endgame">
                {(field) => (
                  <RadioGroup
                    aria-label="Climb"
                    value={field.state.value}
                    onValueChange={handleEndgameChange}
                    className={cn(
                      "grid-cols-2 gap-2",
                      "sm:grid-cols-1 max-lg:landscape:grid-cols-2 max-lg:landscape:gap-1.5",
                    )}
                  >
                    {CLIMBS.map((climb) => (
                      <Label
                        key={climb.value}
                        className={cn(
                          "min-h-12 gap-2.5 rounded-[14px] border px-3 py-1.5 text-[13px] leading-tight font-normal has-data-checked:border-primary/45 has-data-checked:bg-primary/10 has-data-checked:font-semibold has-data-checked:text-[color-mix(in_oklch,var(--color-primary),black_25%)]",
                          "sm:min-h-11 sm:gap-3 sm:px-4 sm:py-0 sm:text-[15px]",
                          "xl:min-h-10 xl:rounded-[12px] xl:px-3.5 xl:text-sm",
                          "max-lg:landscape:min-h-11 max-lg:landscape:gap-2 max-lg:landscape:rounded-[12px] max-lg:landscape:px-2.5 max-lg:landscape:py-0 max-lg:landscape:text-xs",
                        )}
                      >
                        <RadioGroupItem
                          value={climb.value}
                          className={cn(
                            "border-[1.5px] border-stone-400 bg-background",
                            "sm:size-4.5 xl:size-4 max-lg:landscape:size-3.5",
                          )}
                        />
                        <span className="max-lg:landscape:hidden">{climb.label}</span>
                        <span className="hidden max-lg:landscape:inline">{climb.shortLabel}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </form.Field>
            </section>
          </div>
          <section aria-label="Comments">
            <Collapsible
              open={commentsOpen}
              onOpenChange={setCommentsOpen}
              className={cn(
                "mt-2 flex flex-col",
                "sm:mt-0 sm:gap-3",
                "max-lg:landscape:mt-0 max-lg:landscape:gap-0 max-lg:landscape:pt-2",
              )}
            >
              <CollapsibleTrigger
                className={cn(
                  "group flex min-h-12 w-full items-center justify-between rounded-[12px] px-1 py-3 text-left text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  "sm:hidden",
                  "max-lg:landscape:flex max-lg:landscape:min-h-11 max-lg:landscape:px-0 max-lg:landscape:py-2.5 max-lg:landscape:text-[15px]",
                )}
              >
                Comments
                <ChevronDown
                  className={cn(
                    "size-5.5 transition-transform group-data-panel-open:rotate-180",
                    "max-lg:landscape:size-5",
                  )}
                />
              </CollapsibleTrigger>
              <h2 className="hidden text-lg font-semibold sm:block max-lg:landscape:hidden">
                Comments
              </h2>
              <CollapsibleContent
                keepMounted
                hidden={false}
                className={cn(
                  "data-closed:hidden",
                  "sm:data-closed:block max-lg:landscape:data-closed:hidden",
                )}
              >
                <form.Field name="comments">
                  {(field) => (
                    <ToggleGroup
                      multiple
                      variant="outline"
                      value={field.state.value}
                      onValueChange={handleCommentsChange}
                      className={cn(
                        "w-full flex-wrap justify-center gap-2 pt-3 pb-1",
                        "sm:mt-2 sm:py-0 xl:justify-start",
                        "max-lg:landscape:mt-0 max-lg:landscape:pt-3 max-lg:landscape:pb-1",
                      )}
                    >
                      {COMMENTS.map((c) => (
                        <CommentToggle key={c} comment={c} />
                      ))}
                    </ToggleGroup>
                  )}
                </form.Field>
              </CollapsibleContent>
            </Collapsible>
          </section>
          <section
            aria-label="Additional notes"
            className={cn(
              "mt-2 flex flex-col gap-2.5",
              "sm:mt-0 sm:gap-3 xl:gap-5",
              "max-lg:landscape:mt-0 max-lg:landscape:gap-2 max-lg:landscape:pt-2",
            )}
          >
            <Label
              htmlFor="notes"
              className={cn(
                "px-1 text-lg font-semibold",
                "sm:px-0 max-lg:landscape:px-0 max-lg:landscape:text-[15px]",
              )}
            >
              Additional Notes
            </Label>
            <form.Field name="notes">
              {(field) => (
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Type additional comments here."
                  value={field.state.value}
                  onChange={handleText}
                  className={cn(
                    "min-h-22 rounded-[16px] px-4 py-3",
                    "sm:min-h-26 sm:rounded-[18px] sm:px-4.5 sm:py-3.5 md:text-[15px]",
                    "xl:min-h-24 xl:resize-y xl:rounded-[16px] xl:px-4 xl:py-3 xl:text-sm",
                    "max-lg:landscape:min-h-18 max-lg:landscape:rounded-[14px] max-lg:landscape:px-3.5 max-lg:landscape:py-2.5 max-lg:landscape:text-sm",
                  )}
                />
              )}
            </form.Field>
          </section>
        </div>
      )}
      {step === "qr" && (
        <form.Subscribe>
          {(state) => (
            <div
              className={cn(
                "flex flex-1 flex-col items-center gap-5 px-4 pt-1 pb-5 before:order-first before:-mb-5 before:flex-1 after:-mt-5 after:flex-3",
                "sm:px-10 sm:pt-4 sm:pb-10 sm:before:hidden sm:after:hidden",
                "xl:pb-6 lg:max-xl:landscape:justify-center lg:max-xl:landscape:gap-4.5 lg:max-xl:landscape:pt-2 lg:max-xl:landscape:pb-4",
                "max-lg:landscape:flex-row max-lg:landscape:items-center max-lg:landscape:justify-center max-lg:landscape:gap-8 max-lg:landscape:px-6 max-lg:landscape:pt-1 max-lg:landscape:pb-3 max-lg:landscape:before:hidden max-lg:landscape:after:hidden",
              )}
            >
              <div
                className={cn(
                  "rounded-[24px] border bg-background p-5 shadow-[0_1px_2px_rgb(12_10_9/0.04),0_8px_24px_rgb(12_10_9/0.06)]",
                  "sm:rounded-[28px] sm:p-6",
                  "max-lg:landscape:shrink-0 max-lg:landscape:rounded-[20px] max-lg:landscape:p-3.5",
                )}
              >
                <QRCode
                  value={toQrData(state.values)}
                  className={cn(
                    "size-74 max-w-none",
                    "sm:size-110 xl:size-[clamp(15rem,calc(100svh-25rem),27.5rem)]",
                    "max-lg:landscape:size-52",
                  )}
                />
              </div>
              <div
                className={cn(
                  "contents",
                  "max-lg:landscape:mb-16 max-lg:landscape:flex max-lg:landscape:w-75 max-lg:landscape:flex-col max-lg:landscape:items-center max-lg:landscape:gap-5",
                )}
              >
                <div className="order-first flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-xl font-bold tabular-nums",
                      "lg:max-xl:landscape:text-[22px]",
                    )}
                  >
                    QM {state.values.start.matchNumber}
                    <span aria-hidden className="size-1.25 rounded-full bg-foreground" />
                    {state.values.start.team}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.75" /> {state.values.start.position}
                    <span aria-hidden className="size-1 rounded-full bg-muted-foreground" />
                    <User className="size-3.75" /> {state.values.start.scouterName}
                  </span>
                </div>
                <HoldButton
                  disabled={!state.canSubmit}
                  onComplete={handleSave}
                  idleLabel="Hold to save QR code"
                  doneLabel="Saved!"
                  failedLabel="Not saved. Your entries are still here, hold to try again"
                  status={saveStatus}
                  variant="primary"
                  className={cn(
                    "h-13 w-full text-base font-semibold",
                    "sm:w-122.5 sm:max-w-full lg:max-xl:landscape:h-14 lg:max-xl:landscape:w-122",
                    "max-lg:landscape:w-full",
                  )}
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
    </div>
  );
}
