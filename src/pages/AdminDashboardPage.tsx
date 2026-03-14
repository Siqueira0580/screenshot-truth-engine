import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Users, DollarSign, Settings, Menu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminFinancialTab from "@/components/admin/AdminFinancialTab";
import AdminSystemTab from "@/components/admin/AdminSystemTab";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 py-3 md:px-6 flex items-center gap-3 shrink-0">
        <Link to="/songs" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Centro de Comando Admin</h1>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Utilizadores</span>
              <span className="sm:hidden">👥</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
              <span className="sm:hidden">💰</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Sistema</span>
              <span className="sm:hidden">⚙️</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AdminUsersTab />
          </TabsContent>
          <TabsContent value="financial">
            <AdminFinancialTab />
          </TabsContent>
          <TabsContent value="system">
            <AdminSystemTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
