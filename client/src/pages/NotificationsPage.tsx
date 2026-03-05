import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

const PAGE_SIZE = 20;

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  component_approved: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50", label: "Aprovação" },
  component_rejected: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-50", label: "Rejeição" },
  promoted_to_coordinator: { icon: ShieldCheck, color: "text-blue-600", bgColor: "bg-blue-50", label: "Promoção" },
  demoted_to_prof: { icon: ShieldOff, color: "text-orange-600", bgColor: "bg-orange-50", label: "Rebaixamento" },
  removed_from_component: { icon: UserMinus, color: "text-red-600", bgColor: "bg-red-50", label: "Remoção" },
  eval_permission_granted: { icon: UserPlus, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Permissão" },
  eval_permission_revoked: { icon: UserMinus, color: "text-amber-600", bgColor: "bg-amber-50", label: "Revogação" },
  student_transferred: { icon: ArrowRightLeft, color: "text-purple-600", bgColor: "bg-purple-50", label: "Transferência" },
  pending_request: { icon: UserPlus, color: "text-amber-600", bgColor: "bg-amber-50", label: "Solicitação" },
};

const defaultTypeConfig = { icon: Info, color: "text-gray-600", bgColor: "bg-gray-50", label: "Info" };

function formatDate(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay < 7) return `${diffDay}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function NotificationsPage() {
  const [offset, setOffset] = useState(0);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notifications.list.useQuery(
    { limit: PAGE_SIZE, offset },
    { refetchInterval: 30000 }
  );
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onMutate: async ({ notificationId }) => {
      await utils.notifications.list.cancel();
      const prev = utils.notifications.list.getData({ limit: PAGE_SIZE, offset });
      if (prev) {
        utils.notifications.list.setData({ limit: PAGE_SIZE, offset }, {
          ...prev,
          items: prev.items.map((n: any) => n.id === notificationId ? { ...n, read: true } : n),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        utils.notifications.list.setData({ limit: PAGE_SIZE, offset }, context.prev);
      }
    },
    onSettled: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("Todas as notificações marcadas como lidas");
    },
  });

  const deleteNotification = trpc.notifications.delete.useMutation({
    onMutate: async ({ notificationId }) => {
      await utils.notifications.list.cancel();
      const prev = utils.notifications.list.getData({ limit: PAGE_SIZE, offset });
      if (prev) {
        utils.notifications.list.setData({ limit: PAGE_SIZE, offset }, {
          ...prev,
          items: prev.items.filter((n: any) => n.id !== notificationId),
          total: prev.total - 1,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        utils.notifications.list.setData({ limit: PAGE_SIZE, offset }, context.prev);
      }
      toast.error("Erro ao apagar notificação");
    },
    onSettled: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onSuccess: () => {
      toast.success("Notificação apagada");
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} notificação${unreadCount > 1 ? "ões" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                : "Todas as notificações lidas"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-lg font-medium">Nenhuma notificação</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Você será notificado sobre eventos importantes do sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((notification: any) => {
            const config = typeConfig[notification.type] || defaultTypeConfig;
            const Icon = config.icon;
            const isUnread = !notification.read;
            return (
              <Card
                key={notification.id}
                className={`transition-all duration-200 hover:shadow-md ${
                  isUnread ? "border-l-4 border-l-primary bg-primary/[0.02]" : ""
                }`}
              >
                <CardContent className="flex items-start gap-4 py-4 px-5">
                  <div className={`flex-shrink-0 rounded-full p-2.5 ${config.bgColor}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {notification.title}
                      </span>
                      {isUnread ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Nova
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Lida
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${isUnread ? "text-foreground/80" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate({ notificationId: notification.id });
                        }}
                        title="Marcar como lida"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification.mutate({ notificationId: notification.id });
                        }}
                        title="Apagar notificação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
