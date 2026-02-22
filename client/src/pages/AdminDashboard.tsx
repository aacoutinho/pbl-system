import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, ClipboardList, BookOpen, CheckCircle2, Clock, FileCheck,
  Bell, BellOff, ChevronRight, ShieldCheck, ShieldOff, UserPlus, UserMinus,
  XCircle, ArrowRightLeft, Info,
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
  const { data: stats, isLoading } = trpc.results.dashboard.useQuery();
  const { selectedClassId } = useClassContext();
  const { data: sessions } = trpc.sessions.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  // Fetch pending notifications (unread + pending_request still unresolved)
  const { data: pendingNotifs, isLoading: pendingLoading } = trpc.notifications.pendingList.useQuery(
    { limit: 5 },
    { refetchInterval: 30000 }
  );
  const { data: pendingCountData } = trpc.notifications.pendingCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

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

  const handleNotificationClick = (n: any) => {
    // Mark as read if not already read
    if (!n.read) {
      markAsRead.mutate({ notificationId: n.id });
    }
    // Navigate based on type
    if (n.type === "pending_request") {
      setLocation("/professors");
    } else {
      setLocation("/notifications");
    }
  };

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

      {/* Notificações Pendentes - shows unread + pending_request still unresolved */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notificações Pendentes
              {pendingCount > 0 && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">
                  {pendingCount}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setLocation("/notifications")}
            >
              Ver todas
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
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
                const isUnread = !n.read;
                return (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-accent/50 ${
                      isPendingRequest
                        ? "bg-amber-50/50 border-l-2 border-l-amber-400"
                        : "bg-primary/[0.03] border-l-2 border-l-primary"
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className={`flex-shrink-0 rounded-full p-2 ${config.bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate text-foreground">
                          {n.title}
                        </span>
                        {isPendingRequest && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px] px-1.5 py-0">
                            Pendente
                          </Badge>
                        )}
                        {isUnread && (
                          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs truncate text-foreground/70">
                        {n.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
