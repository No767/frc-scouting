import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "cn";
import { Archive, ClipboardList, LayoutGrid, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

/// Types and interfaces

type SidebarStyle = CSSProperties & Record<`--${string}`, string>;

interface NavItem {
  to: "/" | "/saved";
  label: string;
  icon: typeof ClipboardList;
}

/// Constants

const EXACT_ACTIVE_OPTIONS = { exact: true };
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Scout", icon: ClipboardList },
  { to: "/saved", label: "Saved", icon: Archive },
];

const SIDEBAR_STYLE: SidebarStyle = {
  "--sidebar-width": "12.5rem",
  "--sidebar-width-icon": "3.5rem",
};

const SIDEBAR_ITEM_CLASSES =
  "flex w-full items-center overflow-hidden text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&_svg]:shrink-0 [&>span:last-child]:truncate h-11 gap-3 rounded-[10px] px-3 font-medium text-muted-foreground in-data-[mobile=true]:text-[15px] data-[status=active]:bg-primary/12 data-[status=active]:font-semibold data-[status=active]:text-primary hover:data-[status=active]:bg-primary/15 hover:data-[status=active]:text-primary group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden [&_svg]:size-5";
const BOTTOM_ITEM_CLASSES = cn(
  buttonVariants({ variant: "ghost" }),
  "h-auto min-h-13 flex-col gap-1 rounded-none text-xs text-muted-foreground hover:bg-transparent data-[status=active]:font-semibold data-[status=active]:text-primary [&_svg:not([class*='size-'])]:size-6",
);

/// Components

function AppSidebar() {
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();

  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      {isMobile ? (
        <SidebarHeader className="h-14 flex-row items-center justify-between border-b py-0 pr-2 pl-4">
          <span className="text-sm font-bold text-primary">5507 Scouting</span>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Close navigation"
            onClick={closeMobile}
            className="text-muted-foreground"
          >
            <X />
          </Button>
        </SidebarHeader>
      ) : (
        <SidebarHeader className="h-16 flex-row items-center gap-2.5 border-b px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Toggle sidebar"
            aria-expanded={state === "expanded"}
            onClick={toggleSidebar}
            className="rounded-[8px] border-primary/45 bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary aria-expanded:bg-primary/15 aria-expanded:text-primary aria-expanded:hover:bg-primary/25"
          >
            <LayoutGrid />
          </Button>
          <span className="text-sm font-bold whitespace-nowrap text-primary group-data-[collapsible=icon]:hidden">
            5507 Scouting
          </span>
        </SidebarHeader>
      )}
      <SidebarContent>
        <SidebarGroup className="py-3">
          {!isMobile && (
            <SidebarGroupLabel className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
              Scouting
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={EXACT_ACTIVE_OPTIONS}
                    onClick={closeMobile}
                    className={SIDEBAR_ITEM_CLASSES}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function Navbar({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <SidebarProvider defaultOpen={false} style={SIDEBAR_STYLE}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 hidden h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 landscape:max-xl:flex">
          <SidebarTrigger size="icon-lg" />
          <Separator
            orientation="vertical"
            className="data-vertical:h-6 data-vertical:self-center"
          />
          <span className="pl-1 text-[15px] font-semibold">
            {NAV_ITEMS.find((item) => item.to === pathname)?.label}
          </span>
        </header>
        {children}
        <nav
          aria-label="App"
          className="sticky bottom-0 grid grid-cols-2 border-t bg-background pt-1.5 pb-2.5 xl:hidden landscape:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={EXACT_ACTIVE_OPTIONS}
              className={BOTTOM_ITEM_CLASSES}
            >
              <item.icon />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
