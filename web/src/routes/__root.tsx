import "../styles.css";

import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { Navbar } from "@/components/app/navigation-bar";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <Navbar>
      <Outlet />
    </Navbar>
  );
}
