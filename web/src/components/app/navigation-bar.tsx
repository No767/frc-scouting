import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Archive, ClipboardList, LayoutGrid } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useState } from "react";

import beakleLogo from "@/assets/beakle.png";
import { Button, buttonVariants } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

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
  "flex w-full items-center overflow-hidden text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&_svg]:shrink-0 [&>span:last-child]:truncate h-11 gap-3 rounded-[10px] px-3 font-medium text-muted-foreground data-[status=active]:bg-primary/12 data-[status=active]:font-semibold data-[status=active]:text-primary hover:data-[status=active]:bg-primary/15 hover:data-[status=active]:text-primary group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden [&_svg]:size-5";
const RAIL_ITEM_CLASSES = cn(
  "flex size-11 items-center justify-center rounded-[12px] text-muted-foreground ring-sidebar-ring outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 data-[status=active]:bg-primary/12 data-[status=active]:text-primary hover:data-[status=active]:bg-primary/15 [&_svg]:size-5.5 [&_svg]:shrink-0",
  "lg:max-xl:landscape:size-12",
);
const BOTTOM_ITEM_CLASSES = cn(
  buttonVariants({ variant: "ghost" }),
  "h-auto min-h-13 flex-col gap-1 rounded-none text-xs text-muted-foreground hover:bg-transparent data-[status=active]:font-semibold data-[status=active]:text-primary [&_svg:not([class*='size-'])]:size-6",
  "sm:max-xl:portrait:text-[13px]",
);

/// Components

export function Navbar({ children }: Readonly<{ children: ReactNode }>) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} style={SIDEBAR_STYLE}>
      {isMobile ? (
        <Sidebar
          collapsible="none"
          className={cn(
            "sticky top-0 hidden h-svh w-16 shrink-0 self-start border-r landscape:flex",
            "lg:max-xl:landscape:w-18",
          )}
        >
          <SidebarHeader
            className={cn(
              "items-center gap-0 px-0 pt-2.5 pb-2",
              "lg:max-xl:landscape:pt-3.5 lg:max-xl:landscape:pb-2.5",
            )}
          >
            <img
              src={beakleLogo}
              alt="Team 5507"
              className={cn(
                "size-9 rounded-[9px]",
                "lg:max-xl:landscape:size-10 lg:max-xl:landscape:rounded-[10px]",
              )}
            />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="p-0 pt-1.5">
              <SidebarGroupContent>
                <SidebarMenu className="items-center gap-1.5 lg:max-xl:landscape:gap-2">
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <Link
                        to={item.to}
                        activeOptions={EXACT_ACTIVE_OPTIONS}
                        aria-label={item.label}
                        className={RAIL_ITEM_CLASSES}
                      >
                        <item.icon />
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      ) : (
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-16 flex-row items-center gap-2.5 border-b px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
              onClick={handleSidebarToggle}
              className="rounded-[8px] border-primary/45 bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary aria-expanded:bg-primary/15 aria-expanded:text-primary aria-expanded:hover:bg-primary/25"
            >
              <LayoutGrid />
            </Button>
            <span className="text-sm font-bold whitespace-nowrap text-primary group-data-[collapsible=icon]:hidden">
              5507 Scouting
            </span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="py-3">
              <SidebarGroupLabel className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                Scouting
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <Link
                        to={item.to}
                        activeOptions={EXACT_ACTIVE_OPTIONS}
                        aria-label={item.label}
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
      )}
      <SidebarInset>
        {children}
        <nav
          aria-label="App"
          className={cn(
            "sticky bottom-0 grid grid-cols-2 border-t bg-background pt-1.5 pb-2.5 landscape:hidden",
            "xl:hidden sm:max-xl:portrait:pt-2 sm:max-xl:portrait:pb-3",
          )}
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
