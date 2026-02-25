import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2, ShieldCheck, UserPlus, X, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ClassesPage() {
  return (
    <DashboardLayout>
      <ClassesContent />
    </DashboardLayout>
  );
}

function ClassesContent() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: classes, isLoading } = trpc.classes.list.useQuery();
  const { data: componentsList } = trpc.components.list.useQuery();
  const { data: myComponents } = trpc.professors.myComponents.useQuery();
  const { selectedClassId, setSelectedClassId } = useClassContext();

  const createMutation = trpc.classes.create.useMutation({
    onSuccess: () => { utils.classes.list.invalidate(); toast.success("Turma criada com sucesso!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.classes.update.useMutation({
    onSuccess: () => { utils.classes.list.invalidate(); toast.success("Turma atualizada!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.classes.delete.useMutation({
    onSuccess: (_, vars) => {
      utils.classes.list.invalidate();
      if (selectedClassId === vars.id) setSelectedClassId(null);
      toast.success("Turma excluída!");
    },
    onError: (e) => toast.error(e.message),
  });

  const [newClassCode, setNewClassCode] = useState("");
  const [newComponentId, setNewComponentId] = useState<number | null>(null);
  const [newSemester, setNewSemester] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editClassCode, setEditClassCode] = useState("");
  const [editComponentId, setEditComponentId] = useState<number | null>(null);
  const [editSemester, setEditSemester] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [permDialogClassId, setPermDialogClassId] = useState<number | null>(null);

  // Build a map from componentId to component code for display
  const componentMap = new Map<number, { code: string; name: string }>();
  if (componentsList) {
    for (const c of componentsList) {
      componentMap.set(c.id, { code: c.code, name: c.name });
    }
  }

  const handleCreate = () => {
    if (!newClassCode.trim() || !newComponentId || !newSemester.trim()) { 
      toast.error("Preencha todos os campos"); 
      return; 
    }
    createMutation.mutate({ 
      classCode: newClassCode.trim(), 
      componentId: newComponentId, 
      semester: newSemester.trim() 
    });
    setNewClassCode(""); setNewComponentId(null); setNewSemester(""); setCreateOpen(false);
  };

  const handleEdit = () => {
    if (!editId || !editClassCode.trim() || !editComponentId || !editSemester.trim()) return;
    updateMutation.mutate({ 
      id: editId, 
      classCode: editClassCode.trim(), 
      componentId: editComponentId, 
      semester: editSemester.trim() 
    });
    setEditOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turmas</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas turmas e seus alunos.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Turma</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Turma</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Componente</Label>
                {(!componentsList || componentsList.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Nenhum componente cadastrado. Cadastre componentes primeiro.</p>
                ) : (
                  <Select value={newComponentId ? String(newComponentId) : ""} onValueChange={(v) => setNewComponentId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o componente" />
                    </SelectTrigger>
                    <SelectContent>
                      {componentsList.map(c => (
                        <SelectItem key={c.id} value={String(c.id)} title={c.name}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Código da Turma</Label>
                <Input placeholder="Ex: TP01" value={newClassCode} onChange={e => setNewClassCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Semestre</Label>
                <Input placeholder="Ex: 2026.1" value={newSemester} onChange={e => setNewSemester(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newComponentId}>
                {createMutation.isPending ? "Criando..." : "Criar Turma"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!classes || classes.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma turma cadastrada.</p>
            <p className="text-xs mt-1">Clique em "Nova Turma" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map(cls => {
            const comp = cls.componentId ? componentMap.get(cls.componentId) : null;
            const isOwner = cls.professorUserId === user?.id;
            const isAdmin = user?.role === "admin";
            const isCoordinatorOfComponent = myComponents?.some(
              c => c.componentId === cls.componentId && c.componentRole === "coordinator" && c.status === "approved"
            ) ?? false;
            const canManage = isOwner || isAdmin || isCoordinatorOfComponent;
            return (
              <Card key={cls.id} className={`hover:shadow-md transition-all cursor-pointer ${selectedClassId === cls.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedClassId(cls.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{comp?.code ?? "?"} - {cls.classCode}</CardTitle>
                    {selectedClassId === cls.id && (
                      <Badge variant="default" className="text-xs">Selecionada</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-1">{comp?.name ?? ""}</p>
                  <p className="text-sm text-muted-foreground">Semestre: {cls.semester}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 mb-4">
                    <User className="h-3 w-3" />
                    <span>Prof. {(cls as any).professorName ?? "Desconhecido"}{isOwner ? " (você)" : ""}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditId(cls.id); 
                        setEditClassCode(cls.classCode); 
                        setEditComponentId(cls.componentId ?? null); 
                        setEditSemester(cls.semester); 
                        setEditOpen(true);
                      }}>
                        <Pencil className="h-3 w-3 mr-1" />Editar
                      </Button>
                    )}
                    {/* Eval permissions button - visible for class owner, coordinator of component, admin */}
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => setPermDialogClassId(cls.id)}>
                        <ShieldCheck className="h-3 w-3 mr-1" />Autorizações
                      </Button>
                    )}
                    {canManage && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3 mr-1" />Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Turma?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todos os alunos, sessões e avaliações desta turma serão excluídos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: cls.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Componente</Label>
              {(!componentsList || componentsList.length === 0) ? (
                <p className="text-sm text-muted-foreground">Nenhum componente cadastrado.</p>
              ) : (
                <Select value={editComponentId ? String(editComponentId) : ""} onValueChange={(v) => setEditComponentId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o componente" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentsList.map(c => (
                      <SelectItem key={c.id} value={String(c.id)} title={c.name}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Código da Turma</Label>
              <Input placeholder="Ex: TP01" value={editClassCode} onChange={e => setEditClassCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Semestre</Label>
              <Input placeholder="Ex: 2026.1" value={editSemester} onChange={e => setEditSemester(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eval Permissions Dialog */}
      {permDialogClassId && (
        <EvalPermissionsDialog 
          classId={permDialogClassId} 
          onClose={() => setPermDialogClassId(null)} 
        />
      )}
    </div>
  );
}

// ─── Eval Permissions Dialog ───
function EvalPermissionsDialog({ classId, onClose }: { classId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: permissions, isLoading: loadingPerms } = trpc.evalPermissions.list.useQuery({ classId });
  const { data: candidates, isLoading: loadingCandidates } = trpc.evalPermissions.candidates.useQuery({ classId });

  const grantMutation = trpc.evalPermissions.grant.useMutation({
    onSuccess: () => {
      utils.evalPermissions.list.invalidate({ classId });
      utils.evalPermissions.candidates.invalidate({ classId });
      toast.success("Professor autorizado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.evalPermissions.revoke.useMutation({
    onSuccess: () => {
      utils.evalPermissions.list.invalidate({ classId });
      utils.evalPermissions.candidates.invalidate({ classId });
      toast.success("Autorização revogada!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter out already authorized professors from candidates
  const authorizedUserIds = new Set(permissions?.map(p => p.authorizedUserId) ?? []);
  const availableCandidates = candidates?.filter(c => !authorizedUserIds.has(c.userId)) ?? [];

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Autorizações de Avaliação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Currently authorized professors */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Professores Autorizados</h3>
            {loadingPerms ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (!permissions || permissions.length === 0) ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Nenhum professor autorizado. Apenas o professor responsável e coordenadores do componente podem avaliar sessões desta turma.
              </p>
            ) : (
              <div className="space-y-2">
                {permissions.map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">{perm.authorizedUserName}</p>
                      <p className="text-xs text-muted-foreground">{perm.authorizedUserEmail}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeMutation.mutate({ classId, authorizedUserId: perm.authorizedUserId })}
                      disabled={revokeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new authorization */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Adicionar Autorização</h3>
            {loadingCandidates ? (
              <Skeleton className="h-10 w-full" />
            ) : availableCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Não há outros professores disponíveis neste componente para autorizar.
              </p>
            ) : (
              <div className="space-y-2">
                {availableCandidates.map(candidate => (
                  <div key={candidate.userId} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{candidate.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {candidate.userEmail}
                        {candidate.componentRole === "coordinator" && (
                          <Badge variant="secondary" className="ml-2 text-xs">Coordenador</Badge>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => grantMutation.mutate({ classId, authorizedUserId: candidate.userId })}
                      disabled={grantMutation.isPending}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />Autorizar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
