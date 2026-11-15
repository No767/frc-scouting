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
      <div className="flex-1 p-4 md:p-8 xl:px-12 xl:py-10 2xl:p-12">
        <Outlet />
      </div>
    </Navbar>
  );
}
