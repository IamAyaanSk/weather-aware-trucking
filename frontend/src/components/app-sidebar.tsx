import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "#components/ui/sidebar";
import { Route, Package, Users, Container, CreditCard, Truck } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";

interface NavItem {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  disabled: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Plan Route",
    url: "/",
    icon: Route,
    isActive: true,
    disabled: false,
  },
  {
    title: "Loads",
    url: "/loads",
    icon: Package,
    isActive: false,
    disabled: true,
  },
  {
    title: "Drivers",
    url: "/drivers",
    icon: Users,
    isActive: false,
    disabled: true,
  },
  {
    title: "Trailers",
    url: "/trailers",
    icon: Container,
    isActive: false,
    disabled: true,
  },
  {
    title: "Payroll",
    url: "/payroll",
    icon: CreditCard,
    isActive: false,
    disabled: true,
  },
];

export function AppSidebar(): React.JSX.Element {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="flex items-center justify-center py-4">
        <div className="flex size-9 items-center justify-center rounded-lg">
          <Truck className="size-7 text-red-400" />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col items-center py-2">
        <SidebarGroup className="p-0 w-full">
          <SidebarGroupContent>
            <SidebarMenu className="items-center gap-1.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.disabled ? (
                    <SidebarMenuButton
                      isActive={item.isActive}
                      disabled={true}
                      tooltip={item.title}
                      className="cursor-not-allowed opacity-40 hover:bg-transparent"
                    >
                      <item.icon className="size-4" />
                      <span className="sr-only">{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      isActive={item.isActive}
                      tooltip={item.title}
                      render={<Link to={item.url} />}
                    >
                      <item.icon className="size-4" />
                      <span className="sr-only">{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
