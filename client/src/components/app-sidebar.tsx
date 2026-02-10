import {
  Home,
  Users,
  Building2,
  UserCircle,
  FileText,
  Bell,
  BarChart3,
  Phone,
  Mail,
  Upload,
  FileDown,
  Settings,
  Shield,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { FolderKanban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["Admin", "Sales Agent", "Marketing Executive", "Property Manager", "SuperAdmin"],
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Users,
    roles: ["Admin", "Sales Agent", "Marketing Executive", "SuperAdmin"],
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Building2,
    roles: ["Admin", "Sales Agent", "Property Manager", "Marketing Executive", "SuperAdmin"],
  },
  {
    title: "Owners",
    url: "/owners",
    icon: UserCircle,
    roles: ["Admin", "Property Manager", "Marketing Executive", "SuperAdmin"],
  },
  {
    title: "Project Owner",
    url: "/project-owners",
    icon: UserCircle,
    roles: ["Admin", "Property Manager", "Marketing Executive", "SuperAdmin"],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban, // or Building2
    roles: ["Admin", "SuperAdmin", "Sales Agent", "Marketing Executive", "Property Manager"], // use SAME roles as Properties/Owners
  },
  {
    title: "Clients",
    url: "/clients",
    icon: FileText,
    roles: ["Admin", "Sales Agent", "Marketing Executive", "SuperAdmin"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    title: "PDFs",
    url: "/pdfs",
    icon: FileDown,
    roles: ["Admin", "Property Manager", "SuperAdmin"],
  },
  {
    title: "Data Import",
    url: "/import",
    icon: Upload,
    roles: ["Admin", "SuperAdmin"],
  },
  {
    title: "Rent Agreement",
    url: "/rent-agreements",
    icon: FileText, // already imported
    roles: ["Admin", "SuperAdmin", "Sales Agent", "Property Manager"],
  },
  {
    title: "Sell Agreements",
    url: "/sell-agreements",
    icon: FileText,
    roles: ["Admin", "SuperAdmin"],
  },
  // {
  //   title: "Activity Logs",
  //   url: "/activity-logs",
  //   icon: ClipboardList,
  //   roles: ["SuperAdmin"],
  // },
  {
    title: "Users",
    url: "/users",
    icon: Shield,
    roles: ["SuperAdmin"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["SuperAdmin"],
  },
  {
    title: "Contact Form",
    url: "/contact",
    icon: Mail,
    roles: ["SuperAdmin"],
  },

];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const userInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() || "U";

  const filteredMenuItems = menuItems.filter(
    (item) => !user?.role || item.roles.includes(user.role)
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-sidebar-foreground">
              Sangli Properties
            </h2>
            <p className="text-xs text-muted-foreground">LLP</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-8 h-8">
            <AvatarImage
              src={user?.profileImageUrl || undefined}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium text-sidebar-foreground truncate"
              data-testid="user-name"
            >
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"}
            </p>
            <p
              className="text-xs text-muted-foreground truncate"
              data-testid="user-role"
            >
              {user?.role || "Sales Agent"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={logout}
          data-testid="button-logout"
        >
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
