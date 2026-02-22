import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, XCircle, Plus, Trash2, Clock, ShieldCheck, BookOpen, Crown, ArrowRightLeft, AlertTriangle, Mail } from "lucide-react";
import { useLocation } from "wouter";

export default function ProfessorsPage() {
  return (
    <DashboardLayout>
      <ProfessorsContent />
    </DashboardLayout>
  );
}

function ProfessorsContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const isCoordinator = user?.role === "coordinator";

  const { data: pendingList, isLoading: loadingPending } = trpc.professors.pending.useQuery();
  const { data: approvedList, isLoading: loadingApproved } = trpc.professors.approved.useQuery();
  const { data: allComponents } = trpc.professors.allComponents.useQuery();
  const { data: coordinator } = trpc.coordination.current.useQuery();
  const { data: smtpStatus } = trpc.auth.smtpStatus.useQuery();

  const [transferTarget, setTransferTarget] = useState<{ id: number; name: string } | null>(null);

  const approveMut = trpc.professors.approve.useMutation({
    onSuccess: () => {
      utils.professors.pending.invalidate();
      utils.professors.approved.invalidate();
      toast.success("Professor aprovado com sucesso");
    },
  });

  const rejectMut = trpc.professors.reject.useMutation({
    onSuccess: () => {
      utils.professors.pending.invalidate();
      toast.success("Solicitação rejeitada");
    },
  });

  const addComponentMut = trpc.professors.addComponent.useMutation({
    onSuccess: () => {
      utils.professors.allComponents.invalidate();
      toast.success("Componente adicionado");
    },
  });

  const removeComponentMut = trpc.professors.removeComponent.useMutation({
    onSuccess: () => {
      utils.professors.allComponents.invalidate();
      toast.success("Componente removido");
    },
  });

  const transferMut = trpc.coordination.transfer.useMutation({
    onSuccess: () => {
      utils.professors.approved.invalidate();
      utils.coordination.current.invalidate();
      setTransferTarget(null);
      toast.success("Coordenação transferida com sucesso! Faça login novamente para atualizar.");
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err) => toast.error(err.message),
  });

  // Fetch available components for the selector
  const { data: availableComponents } = trpc.components.list.useQuery();

  // Group components by professor
  const componentsByProfessor: Record<number, { name: string; email: string; components: { id: number; code: string | null; name: string | null }[] }> = {};
  if (allComponents) {
    for (const c of allComponents) {
      if (!componentsByProfessor[c.userId]) {
        componentsByProfessor[c.userId] = { name: c.professorName || "-", email: c.professorEmail || "-", components: [] };
      }
      componentsByProfessor[c.userId].components.push({ id: c.componentId, code: c.componentCode, name: c.componentName });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Professores</h1>
        <p className="text-muted-foreground">Gerencie o acesso de professores e seus componentes curriculares.</p>
      </div>

      {/* SMTP Alert for coordinator */}
      {isCoordinator && !smtpStatus?.configured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuração de e-mail pendente</p>
            <p className="text-xs text-amber-700 mt-1">
              Como coordenador, você precisa configurar o servidor SMTP para que os professores possam recuperar suas senhas por e-mail.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => setLocation("/smtp-config")}
            >
              <Mail className="h-3.5 w-3.5" />
              Configurar E-mail
            </Button>
          </div>
        </div>
      )}

      {/* Coordinator Info */}
      {coordinator && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-amber-500" />
              Coordenador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{coordinator.name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground">{coordinator.email || "Sem e-mail"}</p>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                <Crown className="h-3 w-3 mr-1" />
                Coordenador
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Solicitações Pendentes
          </CardTitle>
          <CardDescription>Professores que se cadastraram e aguardam aprovação.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !pendingList || pendingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendingList.map((prof) => (
                <div key={prof.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
                  <div>
                    <p className="font-medium">{prof.name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{prof.email || "Sem e-mail"}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em {new Date(prof.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {isCoordinator && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate({ userId: prof.id })}
                      disabled={approveMut.isPending}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMut.mutate({ userId: prof.id })}
                      disabled={rejectMut.isPending}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Professors with Components */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            Professores Autorizados
          </CardTitle>
          <CardDescription>Professores aprovados e seus componentes curriculares.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingApproved ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !approvedList || approvedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum professor aprovado.</p>
          ) : (
            <div className="space-y-4">
              {approvedList.map((prof) => (
                <ProfessorCard
                  key={prof.id}
                  professor={prof}
                  components={componentsByProfessor[prof.id]?.components || []}
                  availableComponents={availableComponents || []}
                  onAddComponent={(componentId) => addComponentMut.mutate({ userId: prof.id, componentId })}
                  onRemoveComponent={(componentId) => removeComponentMut.mutate({ userId: prof.id, componentId })}
                  isAdding={addComponentMut.isPending}
                  isRemoving={removeComponentMut.isPending}
                  isCoordinator={isCoordinator}
                  isCurrentUser={prof.id === user?.id}
                  coordinatorId={coordinator?.id}
                  onTransfer={() => setTransferTarget({ id: prof.id, name: prof.name || "Professor" })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Coordination Dialog */}
      <Dialog open={!!transferTarget} onOpenChange={() => setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferir Coordenação
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja transferir a coordenação para <strong>{transferTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Atenção
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
              <li>Você perderá os privilégios de coordenador.</li>
              <li>Suas credenciais SMTP serão apagadas.</li>
              <li>O novo coordenador precisará configurar suas próprias credenciais de e-mail.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => transferTarget && transferMut.mutate({ toUserId: transferTarget.id })}
              disabled={transferMut.isPending}
              className="gap-1"
            >
              {transferMut.isPending ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfessorCard({
  professor,
  components,
  availableComponents,
  onAddComponent,
  onRemoveComponent,
  isAdding,
  isRemoving,
  isCoordinator,
  isCurrentUser,
  coordinatorId,
  onTransfer,
}: {
  professor: { id: number; name: string | null; email: string | null; role: string; createdAt: Date };
  components: { id: number; code: string | null; name: string | null }[];
  availableComponents: { id: number; code: string; name: string }[];
  onAddComponent: (componentId: number) => void;
  onRemoveComponent: (componentId: number) => void;
  isAdding: boolean;
  isRemoving: boolean;
  isCoordinator: boolean;
  isCurrentUser: boolean;
  coordinatorId?: number;
  onTransfer: () => void;
}) {
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);

  const assignedIds = new Set(components.map(c => c.id));
  const unassignedComponents = availableComponents.filter(c => !assignedIds.has(c.id));

  const handleAdd = () => {
    if (!selectedComponentId) return;
    onAddComponent(selectedComponentId);
    setSelectedComponentId(null);
  };

  const isProfCoordinator = professor.id === coordinatorId;

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium flex items-center gap-2">
            {professor.name || "Sem nome"}
            {isProfCoordinator && (
              <Crown className="h-4 w-4 text-amber-500" />
            )}
          </p>
          <p className="text-sm text-muted-foreground">{professor.email || "Sem e-mail"}</p>
        </div>
        <div className="flex items-center gap-2">
          {isProfCoordinator ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              <Crown className="h-3 w-3 mr-1" />
              Coordenador
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Professor
            </Badge>
          )}
          {isCoordinator && !isCurrentUser && !isProfCoordinator && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTransfer}
              className="gap-1 text-xs h-7"
              title="Transferir coordenação"
            >
              <ArrowRightLeft className="h-3 w-3" />
              Transferir
            </Button>
          )}
        </div>
      </div>

      {/* Components */}
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          Componentes Autorizados
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {components.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum componente atribuído.</p>
          ) : (
            components.map((comp) => (
              <Badge key={comp.id} variant="secondary" className={`gap-1 ${isCoordinator ? 'pr-1' : ''}`} title={comp.name || ""}>
                {comp.code || "?"}
                {isCoordinator && (
                <button
                  onClick={() => onRemoveComponent(comp.id)}
                  disabled={isRemoving}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                )}
              </Badge>
            ))
          )}
        </div>
        {isCoordinator && unassignedComponents.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedComponentId ?? ""}
            onChange={(e) => setSelectedComponentId(e.target.value ? Number(e.target.value) : null)}
            className="max-w-[200px] h-8 text-sm border rounded-md px-2 bg-background"
          >
            <option value="">Selecionar componente...</option>
            {unassignedComponents.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={isAdding || !selectedComponentId} className="gap-1 h-8">
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>
        )}
      </div>
    </div>
  );
}
