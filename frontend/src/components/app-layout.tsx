import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "#components/ui/sidebar";

export function AppLayout(): React.JSX.Element {
  return (
    <SidebarProvider defaultOpen={false} open={false}>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
        <main className="relative flex-1 h-full overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
