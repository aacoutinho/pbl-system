import { trpc } from "@/lib/trpc";
import { useComponentContext } from "@/contexts/ComponentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, ClipboardList, BookOpen, CheckCircle2, Clock, FileCheck,
  Bell, BellOff, ChevronRight, ShieldCheck, ShieldOff, UserPlus, UserMinus,
  XCircle, ArrowRightLeft, Info, Filter,
} from "lucide-react";
import { useLocation } from "wouter";

const notifTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  component_approved: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50" },
  component_rejected: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-50" },
  promoted_to_coordinator: { icon: ShieldCheck, color: "text-blue-600", bgColor: "bg-blue-50" },
  demoted_to_prof: { icon: ShieldOff, color: "text-orange-600", bgColor: "bg-orange-50" },
  removed_from_component: { icon: UserMinus, color: "text-red-600", bgColor: "bg-red-50" },
  eval_permission_granted: { icon: UserPlus, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  eval_permission_revoked: { icon: UserMinus, color: "text-amber-600", bgColor: "bg-amber-50" },
  student_transferred: { icon: ArrowRightLeft, color: "text-purple-600", bgColor: "bg-purple-50" },
  pending_request: { icon: UserPlus, color: "text-amber-600", bgColor: "bg-amber-50" },
};
const defaultNotifConfig = { icon: Info, color: "text-gray-600", bgColor: "bg-gray-50" };

function formatTimeAgo(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AdminDashboard() {
  const { selectedComponentId, selectedSemester, setSelectedSemester } = useComponentContext();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.results.dashboardByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );

  const { data: semesters } = trpc.classes.semestersByComponent.useQuery(
    { componentId: selectedComponentId! },
    { enabled: !!selectedComponentId }
  );

  const { data: sessions } = trpc.sessions.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );

  const { data: pendingNotifs, isLoading: pendingLoading } = trpc.notifications.pendingList.useQuery(
    { limit: 5 },
    { refetchInterval: 30000 }
  );
  const { data: pendingCountData } = trpc.notifications.pendingCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.pendingList.invalidate();
      utils.notifications.pendingCount.invalidate();
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const pendingCount = pendingCountData?.count ?? 0;
  const pendingList = pendingNotifs ?? [];

  type SessionItem = NonNullable<typeof sessions>[number];
  const activeSessions: SessionItem[] = sessions?.filter((s: SessionItem) =>
    s.status === "initiated" || s.status === "open" || s.status === "closed"
  ) ?? [];
  const finishedSessions: SessionItem[] = sessions?.filter((s: SessionItem) => s.status === "finished") ?? [];

  const handleNotificationClick = (n: any) => {
    if (!n.read) markAsRead.mutate({ notificationId: n.id });
    if (n.type === "pending_request") setLocation("/professors");
    else setLocation("/notifications");
  };

  const sessionLabel = (s: SessionItem) => `${s.classCode} – S${s.sessionNumber}`;

  const statusBadge = (status: string) => {
    if (status === "initiated") return <Badge variant="outline" className="border-blue-300 text-blue-700 text-xs shrink-0">Ativa</Badge>;
    if (status === "open") return <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-xs shrink-0">Em Avaliação</Badge>;
    if (status === "closed") return <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs shrink-0">Fechada</Badge>;
    return <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs shrink-0">Encerrada</Badge>;
  };

  if (!selectedComponentId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Geral</h1>
          <p className="text-muted-foreground mt-1">Selecione um componente para ver as estatísticas.</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum componente selecionado.</p>
            <p className="text-xs mt-1">Use o seletor de componente no menu lateral.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const semesterOptions = semesters ?? [];
  const statCards = [
    { label: "Turmas", value: stats?.totalClasses ?? 0, icon: BookOpen, color: "text-violet-600 bg-violet-50" },
    { label: "Alunos", value: stats?.totalStudents ?? 0, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Sessões", value: stats?.totalSessions ?? 0, icon: ClipboardList, color: "text-emerald-600 bg-emerald-50" },
    { label: "Avaliações", value: stats?.totalEvaluations ?? 0, icon: FileCheck, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Geral</h1>
          <p className="text-muted-foreground mt-1">Visão geral do componente selecionado.</p>
        </div>
        {semesterOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedSemester ?? "all"}
              onValueChange={(v) => setSelectedSemester(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Semestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os semestres</SelectItem>
                {semesterOptions.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
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
      )}

      {/* Notificações Pendentes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notificações Pendentes
              {pendingCount > 0 && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">{pendingCount}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setLocation("/notifications")}>
              Ver todas <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : pendingList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <BellOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação pendente.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingList.map((n: any) => {
                const config = notifTypeConfig[n.type] || defaultNotifConfig;
                const Icon = config.icon;
                const isPendingRequest = n.type === "pending_request";
                return (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-accent/50 ${isPendingRequest ? "bg-amber-50/50 border-l-2 border-l-amber-400" : "bg-primary/[0.03] border-l-2 border-l-primary"}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className={`flex-shrink-0 rounded-full p-2 ${config.bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate text-foreground">{n.title}</span>
                        {isPendingRequest && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px] px-1.5 py-0">Pendente</Badge>
                        )}
                        {!n.read && <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs truncate text-foreground/70">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{formatTimeAgo(n.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Sessões Em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma sessão em andamento.</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation("/sessions")}
                  >
                    <span className="text-sm font-medium truncate">{sessionLabel(s)}</span>
                    {statusBadge(s.status)}
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
            {finishedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma sessão encerrada.</p>
            ) : (
              <div className="space-y-2">
                {finishedSessions.slice(0, 5).map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation("/results")}
                  >
                    <span className="text-sm font-medium truncate">{sessionLabel(s)}</span>
                    <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs shrink-0">Encerrada</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
