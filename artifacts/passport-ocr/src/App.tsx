import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthGate } from "@/components/auth-gate";
import { useApplySystemSettings } from "@/hooks/use-system-settings";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import MasterListPage from "@/pages/master-list";
import CompaniesPage from "@/pages/companies";
import ClientsPage from "@/pages/clients";
import LoaPage from "@/pages/loa";
import LoaPrintPage from "@/pages/loa-print";
import ExpensesPage from "@/pages/expenses";
import BillingPage from "@/pages/billing";
import BillingPrintPage from "@/pages/billing-print";
import PasswordsPage from "@/pages/passwords";
import SettingsPage from "@/pages/settings";
import EmployeeProfilePage from "@/pages/employee-profile";
import UsersPage from "@/pages/users";
import PermissionsPage from "@/pages/permissions";
import ProfilePage from "@/pages/profile";

const queryClient = new QueryClient();

function Router() {
  useApplySystemSettings();
  return (
    <Switch>
      {/* Fully public — no auth gate, no sidebar */}
      <Route path="/loa/:id/print" component={LoaPrintPage} />
      <Route path="/billing/:id/print" component={BillingPrintPage} />
      {/* Everything else requires authentication */}
      <Route>
        <AuthGate>
          <Switch>
            <Route path="/signup" component={SignupPage} />
            <Route path="/login" component={LoginPage} />
            <Route>
              <AppLayout>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/upload" component={UploadPage} />
                  {/* /passports kept as alias so old bookmarks still work */}
                  <Route path="/passports" component={MasterListPage} />
                  <Route path="/master-list" component={MasterListPage} />
                  <Route path="/employees/:id" component={EmployeeProfilePage} />
                  <Route path="/companies" component={CompaniesPage} />
                  <Route path="/clients" component={ClientsPage} />
                  <Route path="/loa" component={LoaPage} />
                  <Route path="/expenses" component={ExpensesPage} />
                  <Route path="/billing" component={BillingPage} />
                  <Route path="/passwords" component={PasswordsPage} />
                  <Route path="/settings" component={SettingsPage} />
                  <Route path="/users" component={UsersPage} />
                  <Route path="/permissions" component={PermissionsPage} />
                  <Route path="/profile" component={ProfilePage} />
                  <Route component={NotFound} />
                </Switch>
              </AppLayout>
            </Route>
          </Switch>
        </AuthGate>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
