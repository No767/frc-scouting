import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">FRC 5507 Scouting App</h1>
			<p className="mt-4 text-lg">Made by Bella, Nicole, and Owen.</p>
			<p className="mt-4 text-lg">
				Edit <code>src/routes/index.tsx</code> to get started.
			</p>
		</div>
	);
}
