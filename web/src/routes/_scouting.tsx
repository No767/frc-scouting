import { createFormHook, createFormHookContexts, formOptions } from "@tanstack/react-form";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, createContext, use, useMemo, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/_scouting")({
  component: ScoutingPage,
});

/// Types and Interfaces

type SavedMatch = z.infer<typeof savedMatchSchema>;

export type Step = (typeof STEPS)[number]["value"];

interface ScoutingState {
  step: Step;
  setStep: Dispatch<SetStateAction<Step>>;
  confirmed: boolean;
  setConfirmed: Dispatch<SetStateAction<boolean>>;
}

/// Constants - metadata

export const EVENT_CODES = [
  { value: "2026cacac", label: "Contra Costa" },
  { value: "2027casnf", label: "San Francisco" },
  { value: "2027caetb", label: "East Bay" },
  { value: "2027cancmp", label: "NorCal DCMP" },
] as const;

export const POSITIONS = [
  { value: "R1", label: "R1" },
  { value: "R2", label: "R2" },
  { value: "R3", label: "R3" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "B3", label: "B3" },
] as const;

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

export const STEPS = [
  { value: "start", label: "Start" },
  { value: "auto", label: "Auto" },
  { value: "tele", label: "Teleop" },
  { value: "qr", label: "QR" },
] as const;

/// Constants - stable/empty data

type ScoutingFormValues = z.input<typeof scoutingFormSchema>;
const BLANK_SCOUTING_FORM: ScoutingFormValues = {
  start: {
    scouterName: "",
    eventCode: "2026cacac",
    matchNumber: "",
    // Base UI's Select uses null for "no selection"; undefined would make it uncontrolled
    // oxlint-disable-next-line unicorn/no-null
    position: null,
    team: "",
  },
  autoCoral: { L4: 0, L3: 0, L2: 0, L1: 0 },
  teleCoral: { L4: 0, L3: 0, L2: 0, L1: 0 },
  endgame: "",
  comments: [],
  notes: "",
};

/// Constants - regular

export const SAVED_MATCHES_KEY = "savedMatches";

/// Zod schemas

const savedMatchSchema = z.object({
  scouter: z.string(),
  key: z.string(),
  team: z.string(),
  qrData: z.string(),
  savedAt: z.number(),
});

export const startSchema = z.object({
  scouterName: z.string().trim().min(1, "Enter your name."),
  eventCode: z.enum(EVENT_CODES.map((event) => event.value)),
  matchNumber: z.string().regex(/^\d+$/u, "Enter a match number."),
  position: z
    .enum(POSITIONS.map((position) => position.value))
    .nullable()
    .refine((position) => position !== null, "Pick a position."),
  team: z.string(),
});

const scoutingFormSchema = z.object({
  start: startSchema,
  autoCoral: z.object({
    L4: z.number(),
    L3: z.number(),
    L2: z.number(),
    L1: z.number(),
  }),
  teleCoral: z.object({
    L4: z.number(),
    L3: z.number(),
    L2: z.number(),
    L1: z.number(),
  }),
  endgame: z.string().min(1, "Pick a climb."),
  comments: z.array(z.string()),
  notes: z.string(),
});

/// Forms

const scoutingFormOptions = formOptions({
  defaultValues: BLANK_SCOUTING_FORM,
  validators: { onChange: scoutingFormSchema },
});

const { useAppForm, useTypedAppFormContext } = createFormHook({
  ...createFormHookContexts(),
  fieldComponents: {},
  formComponents: {},
});

/// Context

export const ScoutingContext = createContext<ScoutingState | undefined>(undefined);

/// Helper functions

export function readSavedMatches(): SavedMatch[] {
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
}

export function toQrData(values: ScoutingFormValues) {
  return [
    values.start.eventCode,
    values.start.matchNumber,
    values.start.position,
    values.start.team,
    values.start.scouterName,
    values.autoCoral.L1,
    values.autoCoral.L2,
    values.autoCoral.L3,
    values.autoCoral.L4,
    values.teleCoral.L1,
    values.teleCoral.L2,
    values.teleCoral.L3,
    values.teleCoral.L4,
    values.endgame,
    ...COMMENTS.map((c) => (values.comments.includes(c) ? 1 : 0)),
    values.notes.replaceAll(/[\t\n]/gu, " "),
  ].join("\t");
}

/// Scouting hook

export function useScouting() {
  const form = useTypedAppFormContext(scoutingFormOptions);
  const scouting = use(ScoutingContext);
  if (!scouting) throw new Error("useScouting must be used inside the /_scouting layout");
  return { form, ...scouting };
}

/// Route

function ScoutingPage() {
  const [step, setStep] = useState<Step>("start");
  const [confirmed, setConfirmed] = useState(false);

  const form = useAppForm({
    ...scoutingFormOptions,
    onSubmit: ({ value, formApi }) => {
      const newEntry: SavedMatch = {
        scouter: value.start.scouterName,
        key: `${value.start.eventCode}_qm${value.start.matchNumber}_${String(value.start.position)}`,
        team: value.start.team,
        qrData: toQrData(value),
        savedAt: Date.now(),
      };
      const nextSaved = [newEntry, ...readSavedMatches().filter((m) => m.key !== newEntry.key)];
      localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(nextSaved));
      formApi.reset(
        {
          ...BLANK_SCOUTING_FORM,
          start: {
            ...value.start,
            matchNumber: String(Number(value.start.matchNumber) + 1),
            team: "",
          },
        },
        { keepDefaultValues: true },
      );
      setConfirmed(false);
      setStep("start");
    },
  });

  const scouting = useMemo(() => ({ step, setStep, confirmed, setConfirmed }), [step, confirmed]);

  return (
    <form.AppForm>
      <ScoutingContext value={scouting}>
        <Outlet />
      </ScoutingContext>
    </form.AppForm>
  );
}
