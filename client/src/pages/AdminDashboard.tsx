import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardList, BarChart3, FileCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.results.dashboard.useQuery();
  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery();

  const openSessions = sessionsList?.filter(s => s.status === "open") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Geral</h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema de avaliação tutorial.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Alunos Cadastrados"
          value={stats?.totalStudents}
          loading={statsLoading}
          color="text-blue-600 bg-blue-50"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Sessões Criadas"
          value={stats?.totalSessions}
          loading={statsLoading}
          color="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Sessões Abertas"
          value={stats?.openSessions}
          loading={statsLoading}
          color="text-amber-600 bg-amber-50"
        />
        <StatCard
          icon={<FileCheck className="h-5 w-5" />}
          label="Avaliações Recebidas"
          value={stats?.totalEvaluations}
          loading={statsLoading}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {/* Open Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sessões Abertas para Avaliação</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : openSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma sessão aberta no momento.</p>
              <p className="text-sm mt-1">Crie uma nova sessão na aba "Sessões".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div>
                    <p className="font-semibold">{session.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Problema {session.problemNumber} · Sessão {session.sessionNumber}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Aberta
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, loading, color }: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading: boolean;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            {icon}
          </div>
          <div>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value ?? 0}</p>
            )}
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
