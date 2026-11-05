import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "#components/ui/sidebar";

export function AppLayout(): React.JSX.Element {
  return (
    <SidebarProvider defaultOpen={false} open={false}>
      <AppSidebar />
      <SidebarInset className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
