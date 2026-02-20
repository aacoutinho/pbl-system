import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardList, BarChart3, BookOpen, CheckCircle2, Clock, FileCheck } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.results.dashboard.useQuery();
  const { selectedClassId } = useClassContext();
  const { data: sessions } = trpc.sessions.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Turmas", value: stats?.totalClasses ?? 0, icon: BookOpen, color: "text-violet-600 bg-violet-50" },
    { label: "Alunos", value: stats?.totalStudents ?? 0, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Sessões", value: stats?.totalSessions ?? 0, icon: ClipboardList, color: "text-emerald-600 bg-emerald-50" },
    { label: "Avaliações", value: stats?.totalEvaluations ?? 0, icon: FileCheck, color: "text-amber-600 bg-amber-50" },
  ];

  const openSessions = sessions?.filter(s => s.status === "open") ?? [];
  const closedSessions = sessions?.filter(s => s.status === "closed") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Geral</h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema de avaliação.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedClassId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Sessões Abertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma sessão aberta nesta turma.</p>
              ) : (
                <div className="space-y-2">
                  {openSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation("/sessions")}>
                      <span className="text-sm font-medium">{s.label}</span>
                      <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">Aberta</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Sessões Encerradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {closedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma sessão encerrada nesta turma.</p>
              ) : (
                <div className="space-y-2">
                  {closedSessions.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation("/results")}>
                      <span className="text-sm font-medium">{s.label}</span>
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-xs">Encerrada</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedClassId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Selecione ou crie uma turma para começar.</p>
            <p className="text-xs mt-1">Use o menu "Turmas" para gerenciar suas turmas.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
