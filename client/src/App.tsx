import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Properties from "@/pages/properties";
import Owners from "@/pages/owners";
import Apartments from "@/pages/apartments";
import ProjectOwners from "@/pages/project-owners";
import Projects from "@/pages/projects";
import Clients from "@/pages/clients";
import Reports from "@/pages/reports";
import Contact from "@/pages/contact";
import ImportData from "@/pages/import";
import PDFsPage from "@/pages/pdfs";
import Settings from "@/pages/settings";
import UsersManagement from "@/pages/users";
import ActivityLogs from "@/pages/activity-logs";
import RentAgreements from "@/pages/rent-agreements";
import SellAgreements from "@/pages/sell-agreements";
import ProjectStatus from "@/pages/project-status";
import ProjectTowers from "@/pages/project-towers";
import ProjectUnitConfigs from "@/pages/project-unit-configs";
import ProjectImages from "@/pages/project-images";
import ProjectDocuments from "@/pages/project-documents";


function Router() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="*" component={() => {
          window.location.href = '/login';
          return null;
        }} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/properties" component={Properties} />
      <Route path="/owners" component={Owners} />
      <Route path="/apartments" component={Apartments} />
      <Route path="/project-owners" component={ProjectOwners} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:projectId/status" component={ProjectStatus} />
      <Route path="/projects/:projectId/towers" component={ProjectTowers} />
      <Route path="/projects/:projectId/units" component={ProjectUnitConfigs} />
      <Route path="/projects/:projectId/images" component={ProjectImages} />
      <Route path="/projects/:projectId/documents" component={ProjectDocuments} />
      <Route path="/clients" component={Clients} />
      <Route path="/reports" component={Reports} />
      <Route path="/pdfs" component={PDFsPage} />
      <Route path="/import" component={ImportData} />
      <Route path="/activity-logs" component={ActivityLogs} />
      <Route path="/users" component={UsersManagement} />
      <Route path="/settings" component={Settings} />
      <Route path="/contact" component={Contact} />
      <Route path="/rent-agreements" component={RentAgreements} />
      <Route path="/sell-agreements" component={SellAgreements} />
      <Route component={NotFound} />
    </Switch>
  );
}


function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Toaster />
      </TooltipProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center gap-4 border-b border-border bg-background px-6 py-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex-1" />
            </header>
            <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
              <Router />
            </main>

          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
