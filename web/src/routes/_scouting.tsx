import { createFormHook, createFormHookContexts, formOptions } from "@tanstack/react-form";
import {
  type MutationStatus,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createStore, set, values } from "idb-keyval";
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
  saveStatus: MutationStatus;
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
    // null is "no match number yet"; the number input shows it as empty.
    // oxlint-disable-next-line unicorn/no-null
    matchNumber: null,
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

/// Constants - storage

// Saved matches get a database of their own. idb-keyval opens it on first use, and can't add a
// second object store to an existing database, so the phase 2 TBA cache opens its own.
export const SAVED_MATCHES_STORE = createStore("saved-matches", "matches");

/// Zod schemas

export const startSchema = z.object({
  scouterName: z.string().trim().min(1, "Enter your name."),
  eventCode: z.enum(EVENT_CODES.map((event) => event.value)),
  // Quals only, so the "qm" in TBA's match key is fixed and only the number is stored.
  matchNumber: z
    .number()
    .nullable()
    .pipe(z.int("Enter a match number.").positive("Enter a match number.")),
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

// One saved match as stored in IndexedDB: the form's validated values plus when it was saved.
// Derived from the form schema, so a new form field is stored with no second edit. The QR string
// is not stored; /saved builds it with toQrData.
const savedMatchSchema = scoutingFormSchema.extend({
  savedAt: z.number(),
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

/** The IndexedDB key of a saved match, for example "2026cacac_qm1_R1". */
export function savedMatchKey(start: SavedMatch["start"]) {
  return `${start.eventCode}_qm${String(start.matchNumber)}_${start.position}`;
}

export function toQrData(formValues: ScoutingFormValues) {
  return [
    formValues.start.eventCode,
    formValues.start.matchNumber,
    formValues.start.position,
    formValues.start.team,
    formValues.start.scouterName,
    formValues.autoCoral.L1,
    formValues.autoCoral.L2,
    formValues.autoCoral.L3,
    formValues.autoCoral.L4,
    formValues.teleCoral.L1,
    formValues.teleCoral.L2,
    formValues.teleCoral.L3,
    formValues.teleCoral.L4,
    formValues.endgame,
    ...COMMENTS.map((c) => (formValues.comments.includes(c) ? 1 : 0)),
    formValues.notes.replaceAll(/[\t\n]/gu, " "),
  ].join("\t");
}

/// Tanstack Query options

// Every saved match on this device, newest first. This queryFn is the only reader of IndexedDB and
// the only place stored rows are parsed. A row that doesn't fit the schema (saved by a build with
// another field list) is skipped, as readSavedMatches did with localStorage.
export const savedMatchesQueryOptions = queryOptions({
  queryKey: ["savedMatches"],
  queryFn: async () => {
    const rows = await values(SAVED_MATCHES_STORE);
    return (
      rows
        .flatMap((row) => {
          const result = savedMatchSchema.safeParse(row);
          if (!result.success) return [];
          return [result.data];
        })
        // IndexedDB returns key order, which puts qm10 before qm2.
        .toSorted((a, b) => b.savedAt - a.savedAt)
    );
  },
  // Only this app writes the store, and its own writes invalidate this query. Another tab's saves
  // show up when this tab becomes visible again.
  staleTime: Infinity,
  refetchOnWindowFocus: "always",
  // A local read that failed won't succeed on a backoff retry.
  retry: false,
  // The default "online" pauses the read while the browser reports offline.
  networkMode: "always",
});

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

  const queryClient = useQueryClient();

  // idb-keyval's set is one put in one readwrite transaction and resolves on transaction complete,
  // so success means the match is committed. Saving the same key again replaces the record.
  // The form resets only on success. If the write fails, the match stays in the form and the save
  // button shows saveStatus "error".
  const { mutate: saveMatch, status: saveStatus } = useMutation({
    mutationFn: async (formValues: ScoutingFormValues) => {
      // TanStack Form hands onSubmit the schema's input type; parse to get the stored type.
      const match = savedMatchSchema.parse({ ...formValues, savedAt: Date.now() });
      await set(savedMatchKey(match.start), match, SAVED_MATCHES_STORE);
      return match;
    },
    onSuccess: ({ start }) => {
      form.reset(
        {
          ...BLANK_SCOUTING_FORM,
          start: { ...start, matchNumber: start.matchNumber + 1, team: "" },
        },
        { keepDefaultValues: true },
      );
      setConfirmed(false);
      setStep("start");
      return queryClient.invalidateQueries({ queryKey: savedMatchesQueryOptions.queryKey });
    },
    networkMode: "always",
  });

  const form = useAppForm({
    ...scoutingFormOptions,
    onSubmit: ({ value }) => {
      saveMatch(value);
    },
  });

  const scouting = useMemo(
    () => ({ step, setStep, confirmed, setConfirmed, saveStatus }),
    [step, confirmed, saveStatus],
  );

  return (
    <form.AppForm>
      <ScoutingContext value={scouting}>
        <Outlet />
      </ScoutingContext>
    </form.AppForm>
  );
}
