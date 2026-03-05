import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ComponentsPage() {
  return (
      <ComponentsContent />
  );
}

function ComponentsContent() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: components, isLoading } = trpc.components.list.useQuery();
  const isAdmin = user?.role === "admin";

  const createMutation = trpc.components.create.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente criado com sucesso!"); setCreateOpen(false); setNewCode(""); setNewName(""); setNewType("TP"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.components.update.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente atualizado!"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.components.delete.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente excluído!"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"T" | "TP">("TP");
  const [editId, setEditId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"T" | "TP">("TP");

  const handleCreate = () => {
    if (!newCode.trim() || !newName.trim()) { toast.error("Preencha código e nome"); return; }
    createMutation.mutate({ code: newCode.trim().toUpperCase(), name: newName.trim(), type: newType });
  };

  const handleEdit = () => {
    if (!editId || !editCode.trim() || !editName.trim()) return;
    updateMutation.mutate({ id: editId, code: editCode.trim().toUpperCase(), name: editName.trim(), type: editType });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Componentes Curriculares</h1>
          <p className="text-muted-foreground mt-1">Gerencie os componentes curriculares do sistema.</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Componente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Componente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input placeholder="Ex: TEC502" value={newCode} onChange={e => setNewCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Concorrência e Conectividade" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as "T" | "TP")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TP">Teórico-Prático (TP)</SelectItem>
                      <SelectItem value="T">Teórico (T)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Define o prefixo das turmas: TP01, TP02... ou T01, T02...</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Componentes Cadastrados
          </CardTitle>
          <CardDescription>
            {isAdmin 
              ? "Apenas o administrador pode criar, editar e excluir componentes." 
              : "Visualização dos componentes cadastrados no sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!components || components.length === 0) ? (
            <div className="py-8 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum componente cadastrado.</p>
              {isAdmin && <p className="text-xs mt-1">Clique em "Novo Componente" para começar.</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  {isAdmin && <TableHead className="w-[120px] text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map(comp => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-mono font-medium">{comp.code}</TableCell>
                    <TableCell>{comp.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {(comp as any).type === "T" ? "Teórico" : "Teórico-Prático"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditId(comp.id);
                            setEditCode(comp.code);
                            setEditName(comp.name);
                            setEditType((comp as any).type || "TP");
                            setEditOpen(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Componente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O componente <strong>{comp.code} - {comp.name}</strong> será excluído. 
                                  Turmas associadas a este componente podem ser afetadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate({ id: comp.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Componente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input placeholder="Ex: TEC502" value={editCode} onChange={e => setEditCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Ex: Concorrência e Conectividade" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as "T" | "TP")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TP">Teórico-Prático (TP)</SelectItem>
                  <SelectItem value="T">Teórico (T)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define o prefixo das turmas: TP01, TP02... ou T01, T02...</p>
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
