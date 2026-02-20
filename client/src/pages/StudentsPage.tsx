import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsPage() {
  return (
    <DashboardLayout>
      <StudentsContent />
    </DashboardLayout>
  );
}

function StudentsContent() {
  const utils = trpc.useUtils();
  const { data: studentsList, isLoading } = trpc.students.list.useQuery();
  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno cadastrado com sucesso"); },
    onError: (e) => toast.error(e.message),
  });
  const bulkMutation = trpc.students.bulkCreate.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Alunos importados com sucesso"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno removido"); },
    onError: (e) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const handleAdd = () => {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Preencha nome e e-mail"); return; }
    createMutation.mutate({ name: newName.trim(), email: newEmail.trim().toLowerCase() });
    setNewName(""); setNewEmail(""); setShowAdd(false);
  };

  const handleBulk = () => {
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[,;\t]+/).map(s => s.trim());
      if (parts.length >= 2) return { name: parts[0], email: parts[1].toLowerCase() };
      return null;
    }).filter(Boolean) as { name: string; email: string }[];
    if (parsed.length === 0) { toast.error("Nenhum aluno válido encontrado. Use formato: Nome, email"); return; }
    bulkMutation.mutate({ students: parsed });
    setBulkText(""); setShowBulk(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os alunos cadastrados no sistema.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />Importar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Alunos em Lote</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Lista de alunos (um por linha: Nome, email)</Label>
                  <Textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"João Silva, joao@email.com\nMaria Santos, maria@email.com"}
                    rows={8}
                    className="mt-2 font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleBulk} disabled={bulkMutation.isPending}>
                  {bulkMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Aluno</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do aluno" className="mt-1" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="aluno@email.com" type="email" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Alunos Cadastrados
            {studentsList && <Badge variant="secondary" className="ml-2">{studentsList.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : !studentsList || studentsList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum aluno cadastrado.</p>
              <p className="text-sm mt-1">Adicione alunos individualmente ou importe em lote.</p>
            </div>
          ) : (
            <div className="divide-y">
              {studentsList.map(student => (
                <div key={student.id} className="flex items-center justify-between py-3 px-2 hover:bg-accent/20 rounded-lg transition-colors">
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Remover ${student.name}?`)) deleteMutation.mutate({ id: student.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
