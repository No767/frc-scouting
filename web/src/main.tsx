import { routeTree } from "./routeTree.gen";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { schedulePersister } from "@/routes/_scouting/index";

const PERSIST_OPTIONS = { persister: schedulePersister };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: Infinity,
    },
  },
});

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector("#app");
if (!rootElement) throw new Error("Root element #app not found");

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <PersistQueryClientProvider client={queryClient} persistOptions={PERSIST_OPTIONS}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>,
  );
}
