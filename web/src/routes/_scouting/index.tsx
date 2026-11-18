import { useFormGroup, useSelector } from "@tanstack/react-form";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
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

interface StepNodeProps {
  value: Step;
  label: string;
  current: boolean;
  disabled: boolean;
  onSelect: (step: Step) => void;
}

/// Constants - stable data

const TEXT_FIELDS = ["start.scouterName", "start.team", "notes"] as const;

/// Constants - validators

const START_VALIDATORS = { onChange: startSchema };
const SCOUTER_NAME_VALIDATORS = { onMount: startSchema.shape.scouterName };
const MATCH_NUMBER_VALIDATORS = { onMount: startSchema.shape.matchNumber };
const POSITION_VALIDATORS = { onMount: startSchema.shape.position };

const manualTeamSchema = z.string().regex(/^\d+$/u, "Enter a team number.");
const TEAM_VALIDATORS = { onMount: manualTeamSchema, onChange: manualTeamSchema };

/// Constants - regular

const TBA_API_URL = "https://www.thebluealliance.com/api/v3";
const TBA_KEY = import.meta.env.VITE_TBA_API_KEY;
const TBA_TIMEOUT_MS = 5000;

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

/// Tanstack Query options

const teamQueryOptions = (
  eventCode: EventCode,
  matchNumber: number | null,
  position: Position | null,
) =>
  queryOptions({
    queryKey: ["teams", eventCode, matchNumber, position],
    queryFn:
      matchNumber !== null && position
        ? async ({ signal }) => {
            const res = await fetch(`${TBA_API_URL}/match/${eventCode}_qm${String(matchNumber)}`, {
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
    retry: false,
    networkMode: "always",
    gcTime: Infinity,
  });

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

  const {
    data: fetchedTeam,
    isError,
    isLoading,
  } = useQuery(teamQueryOptions(eventCode, matchNumber, position));

  const handleConfirm = useCallback(
    ({ value }: { value: z.input<typeof startSchema> }) => {
      form.setFieldValue("start.team", fetchedTeam ?? value.team);
      setConfirmed(true);
      setStep("auto");
    },
    [fetchedTeam, form, setConfirmed, setStep],
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
      // An empty number input reads as NaN, which the form stores as null.
      const { valueAsNumber } = event.target;
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

  const enterTeamManually = isError && fetchedTeam === undefined;
  const teamPlaceholder = isLoading ? "Looking up…" : "Pick an event, match, and position";
  const message = fetchedTeam ?? teamPlaceholder;

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
                )}
              </form.Field>
            </div>
            <div className="mt-6">
              {enterTeamManually ? (
                <form.Field name="start.team" validators={TEAM_VALIDATORS}>
                  {(field) => (
                    <div className="flex flex-col items-center gap-4 rounded-lg border p-4">
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
                  disabled={confirmed || isLoading || !startGroup.state.meta.canSubmit}
                  onComplete={handleConfirmHold}
                  idleLabel={confirmed ? "Confirmed" : "Hold to confirm"}
                  doneLabel="Confirmed!"
                  // An invalid start step leaves confirmed false, so the button doesn't claim it.
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
              <Coral
                levels={field.state.value}
                setLevels={handleAutoCoralChange}
                maxTotal={5}
                maxPerLevel={5}
              />
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
                    maxTotal={25}
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
