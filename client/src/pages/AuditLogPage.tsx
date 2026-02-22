import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowUpCircle, ArrowDownCircle, UserMinus, ShieldCheck, ShieldX, ArrowRightLeft, User } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const ACTION_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  approve_component_request: {
    label: "Solicitação Aprovada",
    icon: CheckCircle2,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  reject_component_request: {
    label: "Solicitação Rejeitada",
    icon: XCircle,
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  promote_to_coordinator: {
    label: "Promovido a Coordenador",
    icon: ArrowUpCircle,
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
  },
  demote_to_prof: {
    label: "Rebaixado a Professor",
    icon: ArrowDownCircle,
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  remove_from_component: {
    label: "Removido do Componente",
    icon: UserMinus,
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  grant_eval_permission: {
    label: "Permissão de Avaliação Concedida",
    icon: ShieldCheck,
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  revoke_eval_permission: {
    label: "Permissão de Avaliação Revogada",
    icon: ShieldX,
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
  transfer_student: {
    label: "Aluno Transferido",
    icon: ArrowRightLeft,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200",
  },
};

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  return (
    <DashboardLayout>
      <AuditLogContent />
    </DashboardLayout>
  );
}

function AuditLogContent() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.auditLogs.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: allComponents } = trpc.components.list.useQuery();
  const { data: allUsers } = trpc.professors.approved.useQuery();

  const componentMap = useMemo(() => {
    const map = new Map<number, string>();
    allComponents?.forEach(c => map.set(c.id, `${c.code} - ${c.name}`));
    return map;
  }, [allComponents]);

  const userMap = useMemo(() => {
    const map = new Map<number, string>();
    allUsers?.forEach((u: any) => map.set(u.id, u.name || u.email || `Usuário #${u.id}`));
    return map;
  }, [allUsers]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  function getTargetUserName(targetUserId: number | null): string {
    if (!targetUserId) return "";
    return userMap.get(targetUserId) || `Usuário #${targetUserId}`;
  }

  function getComponentName(componentId: number | null): string {
    if (!componentId) return "";
    return componentMap.get(componentId) || `Componente #${componentId}`;
  }

  function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildDescription(log: any): string {
    const actor = log.actorName || log.actorEmail || `Usuário #${log.actorUserId}`;
    const target = getTargetUserName(log.targetUserId);
    const component = getComponentName(log.componentId);

    switch (log.action) {
      case "approve_component_request":
        return `${actor} aprovou a solicitação de ${target} para o componente ${component}.`;
      case "reject_component_request":
        return `${actor} rejeitou a solicitação de ${target} para o componente ${component}.`;
      case "promote_to_coordinator":
        return `${actor} promoveu ${target} a coordenador no componente ${component}.`;
      case "demote_to_prof":
        return `${actor} rebaixou ${target} a professor no componente ${component}.`;
      case "remove_from_component":
        return `${actor} removeu ${target} do componente ${component}.`;
      case "grant_eval_permission":
        return `${actor} concedeu permissão de avaliação a ${target}.`;
      case "revoke_eval_permission":
        return `${actor} revogou permissão de avaliação de ${target}.`;
      case "transfer_student": {
        let details = "";
        try {
          const d = JSON.parse(log.details || "{}");
          details = ` (da turma #${d.fromClassId} para turma #${d.toClassId})`;
        } catch {}
        return `${actor} transferiu um aluno entre turmas${details}.`;
      }
      default:
        return `${actor} realizou a ação "${log.action}".`;
    }
  }

  if (!user || (user.role !== "admin" && user.role !== "coordinator")) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <History className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          O histórico de ações é acessível apenas para coordenadores e administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6" />
          Histórico de Ações
        </h1>
        <p className="text-muted-foreground mt-1">
          Registro de aprovações, rejeições, promoções, alterações de permissão e transferências para rastreabilidade administrativa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Recentes</CardTitle>
          <CardDescription>
            {data ? `${data.total} ação(ões) registrada(s)` : "Carregando..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma ação registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.logs.map((log: any) => {
                const actionInfo = ACTION_LABELS[log.action] || {
                  label: log.action,
                  icon: User,
                  color: "text-gray-700",
                  bgColor: "bg-gray-50 border-gray-200",
                };
                const Icon = actionInfo.icon;

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${actionInfo.bgColor}`}
                  >
                    <div className={`mt-0.5 ${actionInfo.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${actionInfo.color} border-current`}>
                          {actionInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 text-foreground/80">
                        {buildDescription(log)}
                      </p>
                      {log.componentId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Componente: {getComponentName(log.componentId)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
