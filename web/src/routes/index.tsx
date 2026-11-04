import { createFileRoute } from "@tanstack/react-router";

import { ScoutingForm } from "@/scouting/scouting-form";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <ScoutingForm />
    </div>
  );
}
