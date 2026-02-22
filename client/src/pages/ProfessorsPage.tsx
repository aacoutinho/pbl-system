import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, XCircle, Plus, Trash2, Clock, ShieldCheck, BookOpen, Crown, ArrowRightLeft, AlertTriangle, Mail, ArrowUp, ArrowDown, UserPlus, Filter } from "lucide-react";
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
  const isAdmin = user?.role === "admin";
  const isCoordinator = user?.role === "coordinator";

  // Filter state
  const [filterComponentId, setFilterComponentId] = useState<string>("all");

  // Data queries
  const { data: pendingSystemList, isLoading: loadingPending } = trpc.professors.pending.useQuery(undefined, { enabled: isAdmin });
  const { data: approvedList, isLoading: loadingApproved } = trpc.professors.approved.useQuery();
  const { data: allProfComponents } = trpc.professors.allComponents.useQuery();
  const { data: coordinator } = trpc.coordination.current.useQuery();
  const { data: smtpStatus } = trpc.auth.smtpStatus.useQuery();
  const { data: availableComponents } = trpc.components.list.useQuery();
  const { data: myComponents } = trpc.professors.myComponents.useQuery();
  const { data: pendingComponentRequests } = trpc.professors.pendingComponentRequests.useQuery(undefined, { enabled: isAdmin || isCoordinator });

  const [transferTarget, setTransferTarget] = useState<{ id: number; name: string } | null>(null);
  const [requestComponentId, setRequestComponentId] = useState<string>("");

  // ─── Mutations ───
  const approveMut = trpc.professors.approve.useMutation({
    onSuccess: () => { utils.professors.pending.invalidate(); utils.professors.approved.invalidate(); toast.success("Professor aprovado com sucesso"); },
  });
  const rejectMut = trpc.professors.reject.useMutation({
    onSuccess: () => { utils.professors.pending.invalidate(); toast.success("Solicitação rejeitada"); },
  });
  const deleteUserMut = trpc.professors.deleteUser.useMutation({
    onSuccess: () => { utils.professors.approved.invalidate(); utils.professors.allComponents.invalidate(); toast.success("Professor removido do sistema"); },
    onError: (err) => toast.error(err.message),
  });
  const addComponentMut = trpc.professors.addComponent.useMutation({
    onSuccess: () => { utils.professors.allComponents.invalidate(); toast.success("Componente adicionado"); },
  });
  const removeComponentMut = trpc.professors.removeComponent.useMutation({
    onSuccess: () => { utils.professors.allComponents.invalidate(); toast.success("Componente removido"); },
  });
  const transferMut = trpc.coordination.transfer.useMutation({
    onSuccess: () => {
      utils.professors.approved.invalidate(); utils.coordination.current.invalidate();
      setTransferTarget(null);
      toast.success("Administração transferida com sucesso! Faça login novamente para atualizar.");
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err) => toast.error(err.message),
  });
  const requestComponentMut = trpc.professors.requestComponent.useMutation({
    onSuccess: () => { utils.professors.myComponents.invalidate(); setRequestComponentId(""); toast.success("Solicitação enviada ao coordenador do componente"); },
    onError: (err) => toast.error(err.message),
  });
  const approveCompReqMut = trpc.professors.approveComponentRequest.useMutation({
    onSuccess: () => { utils.professors.pendingComponentRequests.invalidate(); utils.professors.allComponents.invalidate(); toast.success("Professor aprovado no componente"); },
    onError: (err) => toast.error(err.message),
  });
  const rejectCompReqMut = trpc.professors.rejectComponentRequest.useMutation({
    onSuccess: () => { utils.professors.pendingComponentRequests.invalidate(); toast.success("Solicitação rejeitada"); },
    onError: (err) => toast.error(err.message),
  });
  const promoteToCoordMut = trpc.professors.promoteToCoordinator.useMutation({
    onSuccess: () => { utils.professors.allComponents.invalidate(); utils.professors.approved.invalidate(); toast.success("Professor promovido a coordenador do componente"); },
    onError: (err) => toast.error(err.message),
  });
  const demoteToProfMut = trpc.professors.demoteToProf.useMutation({
    onSuccess: () => { utils.professors.allComponents.invalidate(); utils.professors.approved.invalidate(); toast.success("Coordenador rebaixado a professor no componente"); },
    onError: (err) => toast.error(err.message),
  });
  const removeFromCompMut = trpc.professors.removeFromComponent.useMutation({
    onSuccess: () => { utils.professors.allComponents.invalidate(); toast.success("Professor removido do componente"); },
    onError: (err) => toast.error(err.message),
  });

  // ─── Derived data ───
  // Build map: professorId -> list of { componentId, componentCode, componentName, componentRole }
  const componentsByProfessor = useMemo(() => {
    const map: Record<number, { componentId: number; componentCode: string | null; componentName: string | null; componentRole: string | null }[]> = {};
    if (allProfComponents) {
      for (const c of allProfComponents) {
        if (!map[c.userId]) map[c.userId] = [];
        map[c.userId].push({ componentId: c.componentId, componentCode: c.componentCode, componentName: c.componentName, componentRole: (c as any).componentRole || "prof" });
      }
    }
    return map;
  }, [allProfComponents]);

  // My coordinated component IDs
  const myCoordinatedComponentIds = useMemo(() => {
    if (!myComponents) return new Set<number>();
    return new Set(myComponents.filter(c => c.componentRole === "coordinator" && c.status === "approved").map(c => c.componentId));
  }, [myComponents]);

  // My approved component IDs
  const myApprovedComponentIds = useMemo(() => {
    if (!myComponents) return new Set<number>();
    return new Set(myComponents.filter(c => c.status === "approved").map(c => c.componentId));
  }, [myComponents]);

  // Components I can request to join (not already member or pending)
  const requestableComponents = useMemo(() => {
    if (!availableComponents || !myComponents) return [];
    const myCompIds = new Set(myComponents.map(c => c.componentId));
    return availableComponents.filter(c => !myCompIds.has(c.id));
  }, [availableComponents, myComponents]);

  // Filter approved professors by component
  const filteredApproved = useMemo(() => {
    if (!approvedList) return [];
    if (filterComponentId === "all") return approvedList;
    const compId = parseInt(filterComponentId);
    return approvedList.filter(prof => {
      const profComps = componentsByProfessor[prof.id] || [];
      return profComps.some(c => c.componentId === compId);
    });
  }, [approvedList, filterComponentId, componentsByProfessor]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Professores</h1>
        <p className="text-muted-foreground">Gerencie o acesso de professores e seus componentes curriculares.</p>
      </div>

      {/* SMTP Alert for admin */}
      {isAdmin && !smtpStatus?.configured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuração de e-mail pendente</p>
            <p className="text-xs text-amber-700 mt-1">
              Como administrador, você precisa configurar o servidor SMTP para que os professores possam recuperar suas senhas por e-mail.
            </p>
            <Button size="sm" variant="outline" className="mt-2 gap-1 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setLocation("/smtp-config")}>
              <Mail className="h-3.5 w-3.5" />
              Configurar E-mail
            </Button>
          </div>
        </div>
      )}

      {/* Admin Info */}
      {coordinator && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-amber-500" />
              Administrador
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
                Administrador
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request to join a component (for any approved user) */}
      {!isAdmin && requestableComponents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Solicitar Entrada em Componente
            </CardTitle>
            <CardDescription>Solicite ao coordenador a entrada em um componente curricular.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-center">
              <Select value={requestComponentId} onValueChange={setRequestComponentId}>
                <SelectTrigger className="max-w-[300px]">
                  <SelectValue placeholder="Selecione um componente..." />
                </SelectTrigger>
                <SelectContent>
                  {requestableComponents.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} title={c.name}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => requestComponentId && requestComponentMut.mutate({ componentId: parseInt(requestComponentId) })}
                disabled={!requestComponentId || requestComponentMut.isPending}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Solicitar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending System Requests - admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Solicitações Pendentes (Sistema)
            </CardTitle>
            <CardDescription>Usuários que se cadastraram e aguardam aprovação para entrar no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !pendingSystemList || pendingSystemList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="space-y-3">
                {pendingSystemList.map((prof) => (
                  <div key={prof.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50">
                    <div>
                      <p className="font-medium">{prof.name || "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">{prof.email || "Sem e-mail"}</p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {new Date(prof.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveMut.mutate({ userId: prof.id })} disabled={approveMut.isPending} className="gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectMut.mutate({ userId: prof.id })} disabled={rejectMut.isPending} className="gap-1">
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Component Requests - for coordinators of those components */}
      {(isAdmin || isCoordinator) && pendingComponentRequests && pendingComponentRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Solicitações de Entrada em Componentes
            </CardTitle>
            <CardDescription>Professores que solicitaram entrada nos seus componentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingComponentRequests.map((req: any) => (
                <div key={`${req.userId}-${req.componentId}`} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50">
                  <div>
                    <p className="font-medium">{req.userName || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{req.userEmail || "Sem e-mail"}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      <BookOpen className="h-3 w-3 mr-1" />
                      {req.componentCode}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveCompReqMut.mutate({ userId: req.userId, componentId: req.componentId })}
                      disabled={approveCompReqMut.isPending}
                      className="gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectCompReqMut.mutate({ userId: req.userId, componentId: req.componentId })}
                      disabled={rejectCompReqMut.isPending}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Professors with filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                Professores Autorizados
              </CardTitle>
              <CardDescription>Professores aprovados e seus componentes curriculares.</CardDescription>
            </div>
            {/* Component filter */}
            {availableComponents && availableComponents.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterComponentId} onValueChange={setFilterComponentId}>
                  <SelectTrigger className="w-[220px] h-9 text-sm">
                    <SelectValue placeholder="Filtrar por componente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                     {availableComponents.map(c => (
                       <SelectItem key={c.id} value={String(c.id)} title={c.name}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingApproved ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredApproved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum professor encontrado.</p>
          ) : (
            <div className="space-y-4">
              {filteredApproved.map((prof) => (
                <ProfessorCard
                  key={prof.id}
                  professor={prof}
                  components={componentsByProfessor[prof.id] || []}
                  availableComponents={availableComponents || []}
                  isAdmin={isAdmin}
                  isCurrentUser={prof.id === user?.id}
                  coordinatorId={coordinator?.id}
                  myCoordinatedComponentIds={myCoordinatedComponentIds}
                  onTransfer={() => setTransferTarget({ id: prof.id, name: prof.name || "Professor" })}
                  onAddComponent={(componentId) => addComponentMut.mutate({ userId: prof.id, componentId })}
                  onRemoveComponent={(componentId) => removeFromCompMut.mutate({ userId: prof.id, componentId })}
                  onPromote={(componentId) => promoteToCoordMut.mutate({ userId: prof.id, componentId })}
                  onDemote={(componentId) => demoteToProfMut.mutate({ userId: prof.id, componentId })}
                  onDeleteUser={() => deleteUserMut.mutate({ userId: prof.id })}
                  isAdding={addComponentMut.isPending}
                  isRemoving={removeFromCompMut.isPending}
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
              Transferir Administração
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja transferir a administração para <strong>{transferTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Atenção
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
              <li>Você perderá os privilégios de administrador.</li>
              <li>Suas credenciais SMTP serão apagadas.</li>
              <li>O novo administrador precisará configurar suas próprias credenciais de e-mail.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => transferTarget && transferMut.mutate({ toUserId: transferTarget.id })}
              disabled={transferMut.isPending}
              className="gap-1"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Confirmar Transferência
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
  isAdmin,
  isCurrentUser,
  coordinatorId,
  myCoordinatedComponentIds,
  onTransfer,
  onAddComponent,
  onRemoveComponent,
  onPromote,
  onDemote,
  onDeleteUser,
  isAdding,
  isRemoving,
}: {
  professor: { id: number; name: string | null; email: string | null; role: string; createdAt: Date };
  components: { componentId: number; componentCode: string | null; componentName: string | null; componentRole: string | null }[];
  availableComponents: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  isCurrentUser: boolean;
  coordinatorId?: number;
  myCoordinatedComponentIds: Set<number>;
  onTransfer: () => void;
  onAddComponent: (componentId: number) => void;
  onRemoveComponent: (componentId: number) => void;
  onPromote: (componentId: number) => void;
  onDemote: (componentId: number) => void;
  onDeleteUser: () => void;
  isAdding: boolean;
  isRemoving: boolean;
}) {
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const assignedIds = new Set(components.map(c => c.componentId));
  const unassignedComponents = availableComponents.filter(c => !assignedIds.has(c.id));

  const handleAdd = () => {
    if (!selectedComponentId) return;
    onAddComponent(parseInt(selectedComponentId));
    setSelectedComponentId("");
  };

  const isProfAdmin = professor.id === coordinatorId;

  // Can current user manage this professor's component?
  const canManageComponent = (componentId: number) => {
    if (isAdmin) return true;
    return myCoordinatedComponentIds.has(componentId);
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium flex items-center gap-2">
            {professor.name || "Sem nome"}
            {isProfAdmin && <Crown className="h-4 w-4 text-amber-500" />}
          </p>
          <p className="text-sm text-muted-foreground">{professor.email || "Sem e-mail"}</p>
        </div>
        <div className="flex items-center gap-2">
          {isProfAdmin ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              <Crown className="h-3 w-3 mr-1" />
              Administrador
            </Badge>
          ) : professor.role === "coordinator" ? (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Coordenador
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Professor
            </Badge>
          )}
          {isAdmin && !isCurrentUser && !isProfAdmin && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={onTransfer} className="gap-1 text-xs h-7" title="Transferir administração">
                <ArrowRightLeft className="h-3 w-3" />
                Transferir
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="gap-1 text-xs h-7" title="Remover do sistema">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Components with role management */}
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          Componentes
        </p>
        <div className="space-y-2 mb-2">
          {components.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum componente atribuído.</p>
          ) : (
            components.map((comp) => (
              <div key={comp.componentId} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" title={comp.componentName || ""}>
                    {comp.componentCode || "?"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{comp.componentName}</span>
                  {comp.componentRole === "coordinator" && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Coordenador</Badge>
                  )}
                </div>
                {canManageComponent(comp.componentId) && !isCurrentUser && !isProfAdmin && (
                  <div className="flex gap-1">
                    {comp.componentRole === "prof" ? (
                      <Button size="sm" variant="ghost" onClick={() => onPromote(comp.componentId)} className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700" title="Promover a coordenador">
                        <ArrowUp className="h-3 w-3" />
                        Coordenador
                      </Button>
                    ) : comp.componentRole === "coordinator" ? (
                      <Button size="sm" variant="ghost" onClick={() => onDemote(comp.componentId)} className="h-7 text-xs gap-1 text-orange-600 hover:text-orange-700" title="Rebaixar a professor">
                        <ArrowDown className="h-3 w-3" />
                        Professor
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => onRemoveComponent(comp.componentId)} disabled={isRemoving} className="h-7 text-xs text-destructive hover:text-destructive" title="Remover do componente">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {/* Add component (admin only) */}
        {isAdmin && !isProfAdmin && unassignedComponents.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
              <SelectTrigger className="max-w-[220px] h-8 text-sm">
                <SelectValue placeholder="Adicionar componente..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedComponents.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} title={c.name}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleAdd} disabled={isAdding || !selectedComponentId} className="gap-1 h-8">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remover Professor do Sistema
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{professor.name}</strong> do sistema? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { onDeleteUser(); setShowDeleteConfirm(false); }}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
