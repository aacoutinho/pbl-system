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

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleCreate = () => {
    if (!newName.trim() || !newCode.trim()) { toast.error("Preencha todos os campos"); return; }
    createMutation.mutate({ name: newName.trim(), code: newCode.trim() });
    setNewName(""); setNewCode(""); setCreateOpen(false);
  };

  const handleEdit = () => {
    if (!editId || !editName.trim() || !editCode.trim()) return;
    updateMutation.mutate({ id: editId, name: editName.trim(), code: editCode.trim() });
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
                <Label>Código da Turma</Label>
                <Input placeholder="Ex: TEC502-2025.2" value={newCode} onChange={e => setNewCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome da Turma</Label>
                <Input placeholder="Ex: Concorrência e Conectividade" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
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
          {classes.map(cls => (
            <Card key={cls.id} className={`hover:shadow-md transition-all cursor-pointer ${selectedClassId === cls.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedClassId(cls.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cls.code}</CardTitle>
                  {selectedClassId === cls.id && (
                    <Badge variant="default" className="text-xs">Selecionada</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{cls.name}</p>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditId(cls.id); setEditName(cls.name); setEditCode(cls.code); setEditOpen(true);
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
          ))}
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
              <Label>Código da Turma</Label>
              <Input value={editCode} onChange={e => setEditCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome da Turma</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
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
