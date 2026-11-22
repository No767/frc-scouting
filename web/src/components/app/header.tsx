import beakleLogo from "@/assets/beakle.png";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Header() {
  return (
    <CardHeader className="flex items-center gap-4">
      <img src={beakleLogo} width={62} alt="Team 5507" className="shrink-0 rounded-lg" />
      <div className="grid gap-1.5">
        <CardTitle>FRC 5507 Scouting Form</CardTitle>
        <CardDescription>Generate a scouting data QR code.</CardDescription>
      </div>
    </CardHeader>
  );
}
