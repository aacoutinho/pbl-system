import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
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
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
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
  const utils = trpc.useUtils();
  const { data: classes, isLoading } = trpc.classes.list.useQuery();
  const { data: componentsList } = trpc.components.list.useQuery();
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
                        <SelectItem key={c.id} value={String(c.id)}>{c.code} - {c.name}</SelectItem>
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
                <Input placeholder="Ex: 20262" value={newSemester} onChange={e => setNewSemester(e.target.value)} />
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
                  <p className="text-sm text-muted-foreground mb-4">Semestre: {cls.semester}</p>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditId(cls.id); 
                      setEditClassCode(cls.classCode); 
                      setEditComponentId(cls.componentId ?? null); 
                      setEditSemester(cls.semester); 
                      setEditOpen(true);
                    }}>
                      <Pencil className="h-3 w-3 mr-1" />Editar
                    </Button>
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
                      <SelectItem key={c.id} value={String(c.id)}>{c.code} - {c.name}</SelectItem>
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
              <Input placeholder="Ex: 20262" value={editSemester} onChange={e => setEditSemester(e.target.value)} />
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
    </div>
  );
}
