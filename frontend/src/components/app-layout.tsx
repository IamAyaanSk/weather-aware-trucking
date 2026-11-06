import { useState, useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "#components/ui/sidebar";
import { PasscodeGate } from "./passcode-gate";
import { getStoredSiteToken } from "../api/client";

export function AppLayout(): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    Boolean(getStoredSiteToken()),
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener("spotter:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("spotter:unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <>
      {!isAuthenticated && (
        <PasscodeGate onUnlock={() => setIsAuthenticated(true)} />
      )}
      <SidebarProvider defaultOpen={false} open={false}>
        <AppSidebar />
        <SidebarInset className="flex h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
          <main className="relative flex-1 h-full overflow-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
