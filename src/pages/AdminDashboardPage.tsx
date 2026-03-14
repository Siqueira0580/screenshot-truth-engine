import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, BarChart3, Users, Settings, Menu } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import { useState } from "react";

const mobileNavItems = [
  { to: "/admin", icon: BarChart3, label: "Visão Geral", end: true },
  { to: "/admin/users", icon: Users, label: "Utilizadores" },
  { to: "/admin/settings", icon: Settings, label: "Configurações" },
];

export default function AdminDashboardPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 py-3 md:px-6 flex items-center gap-3 shrink-0">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0">
            <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground text-sm">Admin</span>
            </div>
            <nav className="p-3 space-y-1">
              {mobileNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSheetOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/songs" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Painel de Administração</h1>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route index element={<AdminOverviewTab />} />
            <Route path="users" element={<AdminUsersTab />} />
            <Route path="settings" element={<AdminSettingsTab />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
