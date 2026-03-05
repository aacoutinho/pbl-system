import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useComponentContext } from "@/contexts/ComponentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2, ShieldCheck, UserPlus, X, User, UserCog, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ClassesPage() {
  return <ClassesContent />;
}

function ClassesContent() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { selectedComponentId, selectedComponentFullLabel } = useComponentContext();

  // Semestre filter
  const { data: semesters } = trpc.classes.semestersByComponent.useQuery(
    { componentId: selectedComponentId! },
    { enabled: !!selectedComponentId }
  );
  const latestSemester = semesters?.[0] ?? null;
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  useEffect(() => {
    if (latestSemester && selectedSemester === null) setSelectedSemester(latestSemester);
  }, [latestSemester]);
  useEffect(() => { setSelectedSemester(null); }, [selectedComponentId]);

  // Classes filtered by component and semester
  const { data: classes, isLoading } = trpc.classes.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );
  const { data: componentsList } = trpc.components.list.useQuery();
  const { data: myComponents } = trpc.professors.myComponents.useQuery();

  const createMutation = trpc.classes.create.useMutation({
    onSuccess: () => { utils.classes.list.invalidate(); utils.classes.listByComponent.invalidate(); toast.success("Turma criada com sucesso!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.classes.update.useMutation({
    onSuccess: () => { utils.classes.list.invalidate(); utils.classes.listByComponent.invalidate(); toast.success("Turma atualizada!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.classes.delete.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      utils.classes.listByComponent.invalidate();
      toast.success("Turma excluída!");
    },
    onError: (e) => toast.error(e.message),
  });

  const [newClassNumber, setNewClassNumber] = useState("");
  const [newComponentId, setNewComponentId] = useState<number | null>(null);
  const [newSemYear, setNewSemYear] = useState(() => String(new Date().getFullYear()));
  const [newSemNum, setNewSemNum] = useState<"1" | "2">("1");
  const [newProfessorUserId, setNewProfessorUserId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editClassNumber, setEditClassNumber] = useState("");
  const [editComponentId, setEditComponentId] = useState<number | null>(null);
  const [editSemYear, setEditSemYear] = useState("");
  const [editSemNum, setEditSemNum] = useState<"1" | "2">("1");
  const [editProfessorUserId, setEditProfessorUserId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [permDialogClassId, setPermDialogClassId] = useState<number | null>(null);
  const [changeProfDialogClassId, setChangeProfDialogClassId] = useState<number | null>(null);

  // Build a map from componentId to component info for display
  const componentMap = new Map<number, { code: string; name: string; type: string }>();
  if (componentsList) {
    for (const c of componentsList) {
      componentMap.set(c.id, { code: c.code, name: c.name, type: (c as any).type || "TP" });
    }
  }

  // Helper to extract number from classCode (e.g. "TP01" -> 1, "T03" -> 3)
  const extractClassNumber = (classCode: string): string => {
    const match = classCode.match(/\d+$/);
    return match ? String(parseInt(match[0], 10)) : "1";
  };

  // Get the type prefix for the selected component in create form
  const newCompType = newComponentId ? (componentMap.get(newComponentId)?.type || "TP") : "TP";
  const editCompType = editComponentId ? (componentMap.get(editComponentId)?.type || "TP") : "TP";

  const handleCreate = () => {
    const num = parseInt(newClassNumber, 10);
    const year = parseInt(newSemYear, 10);
    if (!num || !newComponentId || !year || year < 2000 || year > 2100) { 
      toast.error("Preencha todos os campos corretamente"); 
      return; 
    }
    const semester = `${year}.${newSemNum}`;
    createMutation.mutate({ 
      classNumber: num, 
      componentId: newComponentId, 
      semester,
      professorUserId: newProfessorUserId ?? undefined,
    });
    setNewClassNumber(""); setNewComponentId(null); setNewSemYear(String(new Date().getFullYear())); setNewSemNum("1"); setNewProfessorUserId(null); setCreateOpen(false);
  };

  const handleEdit = () => {
    const num = parseInt(editClassNumber, 10);
    const year = parseInt(editSemYear, 10);
    if (!editId || !num || !editComponentId || !year || year < 2000 || year > 2100) return;
    const semester = `${year}.${editSemNum}`;
    updateMutation.mutate({ 
      id: editId, 
      classNumber: num, 
      componentId: editComponentId, 
      semester,
      professorUserId: editProfessorUserId ?? undefined,
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

  if (!selectedComponentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione um Componente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione um componente no menu lateral para visualizar as turmas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turmas</h1>
          {selectedComponentFullLabel && (
            <p className="text-sm font-semibold text-primary mt-0.5">{selectedComponentFullLabel}</p>
          )}
          <p className="text-muted-foreground mt-1 text-sm">Turmas do componente selecionado.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm whitespace-nowrap">Semestre:</Label>
            <Select
              value={selectedSemester ?? ""}
              onValueChange={(v) => setSelectedSemester(v || null)}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Semestre" />
              </SelectTrigger>
              <SelectContent>
                {(semesters ?? []).map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                  <Select value={newComponentId ? String(newComponentId) : ""} onValueChange={(v) => { setNewComponentId(Number(v)); setNewProfessorUserId(null); }}>
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
              {newComponentId && (
                <ProfessorSelectorField
                  componentId={newComponentId}
                  value={newProfessorUserId}
                  onChange={setNewProfessorUserId}
                  label="Professor Responsável"
                  placeholder="Padrão: você mesmo"
                />
              )}
              <div className="space-y-2">
                <Label>Número da Turma</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">{newCompType}</span>
                  <Input 
                    type="number" 
                    min={1} 
                    max={99} 
                    placeholder="Ex: 1" 
                    value={newClassNumber} 
                    onChange={e => setNewClassNumber(e.target.value)} 
                    className="w-24"
                  />
                  {newClassNumber && (
                    <span className="text-sm text-muted-foreground">
                      = <strong className="font-mono">{newCompType}{String(parseInt(newClassNumber) || 0).padStart(2, "0")}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Semestre</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min={2000} 
                    max={2100} 
                    placeholder="Ano" 
                    value={newSemYear} 
                    onChange={e => setNewSemYear(e.target.value)} 
                    className="w-28"
                  />
                  <span className="text-muted-foreground font-medium">.</span>
                  <Select value={newSemNum} onValueChange={(v) => setNewSemNum(v as "1" | "2")}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    = <strong className="font-mono">{newSemYear}.{newSemNum}</strong>
                  </span>
                </div>
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
              <Card key={cls.id} className="hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{comp?.code ?? "?"} - {cls.classCode}</CardTitle>
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
                        setEditClassNumber(extractClassNumber(cls.classCode)); 
                        setEditComponentId(cls.componentId ?? null); 
                        const semParts = cls.semester.split(".");
                        setEditSemYear(semParts[0] || String(new Date().getFullYear()));
                        setEditSemNum((semParts[1] === "2" ? "2" : "1") as "1" | "2"); 
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
                      <Button variant="outline" size="sm" onClick={() => setChangeProfDialogClassId(cls.id)}>
                        <UserCog className="h-3 w-3 mr-1" />Professor
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
                  <Select value={editComponentId ? String(editComponentId) : ""} onValueChange={(v) => { setEditComponentId(Number(v)); setEditProfessorUserId(null); }}>
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
              {editComponentId && (
                <ProfessorSelectorField
                  componentId={editComponentId}
                  value={editProfessorUserId}
                  onChange={setEditProfessorUserId}
                  label="Professor Responsável"
                  placeholder="Manter atual"
                />
              )}
            <div className="space-y-2">
              <Label>Número da Turma</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">{editCompType}</span>
                <Input 
                  type="number" 
                  min={1} 
                  max={99} 
                  placeholder="Ex: 1" 
                  value={editClassNumber} 
                  onChange={e => setEditClassNumber(e.target.value)} 
                  className="w-24"
                />
                {editClassNumber && (
                  <span className="text-sm text-muted-foreground">
                    = <strong className="font-mono">{editCompType}{String(parseInt(editClassNumber) || 0).padStart(2, "0")}</strong>
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Semestre</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min={2000} 
                  max={2100} 
                  placeholder="Ano" 
                  value={editSemYear} 
                  onChange={e => setEditSemYear(e.target.value)} 
                  className="w-28"
                />
                <span className="text-muted-foreground font-medium">.</span>
                <Select value={editSemNum} onValueChange={(v) => setEditSemNum(v as "1" | "2")}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  = <strong className="font-mono">{editSemYear}.{editSemNum}</strong>
                </span>
              </div>
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

      {/* Change Professor Dialog */}
      {changeProfDialogClassId && (
        <ChangeProfessorDialog
          classId={changeProfDialogClassId}
          onClose={() => setChangeProfDialogClassId(null)}
        />
      )}
    </div>
  );
}

// ─── Professor Selector Field ───
function ProfessorSelectorField({
  componentId,
  value,
  onChange,
  label,
  placeholder,
}: {
  componentId: number;
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  placeholder: string;
}) {
  const { data: professors, isLoading } = trpc.classes.listProfessorsForComponent.useQuery({ componentId });
  if (isLoading) return <Skeleton className="h-10 w-full" />;
  if (!professors || professors.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ? String(value) : ""}
        onValueChange={(v) => onChange(v ? Number(v) : null)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {professors.map(p => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
              {p.componentRole === "coordinator" && " (Coord.)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Change Professor Dialog ───
function ChangeProfessorDialog({ classId, onClose }: { classId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: cls } = trpc.classes.list.useQuery();
  const classData = cls?.find(c => c.id === classId);
  const componentId = classData?.componentId;
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

  const updateProfMutation = trpc.classes.updateProfessor.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("Professor responsável atualizado!");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Alterar Professor Responsável
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {classData && (
            <p className="text-sm text-muted-foreground">
              Professor atual: <strong>{(classData as any).professorName ?? "Desconhecido"}</strong>
            </p>
          )}
          {componentId && (
            <ProfessorSelectorField
              componentId={componentId}
              value={selectedProfId}
              onChange={setSelectedProfId}
              label="Novo Professor Responsável"
              placeholder="Selecione um professor"
            />
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button
            onClick={() => {
              if (!selectedProfId) { toast.error("Selecione um professor"); return; }
              updateProfMutation.mutate({ id: classId, professorUserId: selectedProfId });
            }}
            disabled={updateProfMutation.isPending || !selectedProfId}
          >
            {updateProfMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
