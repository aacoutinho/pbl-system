import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Lock, Unlock, Trash2, ClipboardList, Users, Eye, BookOpen } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function SessionsPage() {
  return (
    <DashboardLayout>
      <SessionsContent />
    </DashboardLayout>
  );
}

function SessionsContent() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { selectedClassId } = useClassContext();

  const { data: sessionsList, isLoading } = trpc.sessions.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const { data: studentsList } = trpc.students.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão criada com sucesso"); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });
  const closeMutation = trpc.sessions.close.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão encerrada"); },
  });
  const openMutation = trpc.sessions.open.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão reaberta"); },
  });
  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão removida"); },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [problemNum, setProblemNum] = useState("1");
  const [sessionNum, setSessionNum] = useState("1");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione uma Turma</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione uma turma no menu lateral para gerenciar suas sessões.
        </p>
      </div>
    );
  }

  const handleCreate = () => {
    const pn = parseInt(problemNum);
    const sn = parseInt(sessionNum);
    if (isNaN(pn) || isNaN(sn) || pn < 1 || sn < 1) { toast.error("Números inválidos"); return; }
    if (selectedStudents.length === 0) { toast.error("Selecione ao menos um aluno"); return; }
    createMutation.mutate({
      classId: selectedClassId,
      problemNumber: pn,
      sessionNumber: sn,
      label: `Problema ${pn} - Sessão ${sn}`,
      studentIds: selectedStudents,
    });
  };

  const toggleStudent = (id: number) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (studentsList) {
      if (selectedStudents.length === studentsList.length) setSelectedStudents([]);
      else setSelectedStudents(studentsList.map(s => s.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessões</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie sessões de avaliação tutorial.</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova Sessão</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Nova Sessão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Problema</Label>
                  <Input type="number" min={1} max={10} value={problemNum} onChange={e => setProblemNum(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Sessão</Label>
                  <Input type="number" min={1} max={10} value={sessionNum} onChange={e => setSessionNum(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Alunos da Sessão</Label>
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    {selectedStudents.length === (studentsList?.length ?? 0) ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {!studentsList || studentsList.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Nenhum aluno cadastrado. Cadastre alunos primeiro.</p>
                  ) : (
                    studentsList.map(student => (
                      <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors">
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedStudents.length} aluno(s) selecionado(s)</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Sessão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Sessões de Avaliação
            {sessionsList && <Badge variant="secondary" className="ml-2">{sessionsList.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : !sessionsList || sessionsList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma sessão criada nesta turma.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessionsList.map(session => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onClose={() => closeMutation.mutate({ id: session.id })}
                  onOpen={() => openMutation.mutate({ id: session.id })}
                  onDelete={() => { if (confirm(`Excluir "${session.label}"? Todas as avaliações serão perdidas.`)) deleteMutation.mutate({ id: session.id }); }}
                  onViewResults={() => setLocation(`/results?session=${session.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionRow({ session, onClose, onOpen, onDelete, onViewResults }: {
  session: { id: number; label: string; problemNumber: number; sessionNumber: number; status: string };
  onClose: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onViewResults: () => void;
}) {
  const { data: status } = trpc.sessions.submissionStatus.useQuery({ sessionId: session.id });
  const submitted = status?.filter(s => s.submitted).length ?? 0;
  const total = status?.length ?? 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{session.label}</p>
          <Badge variant={session.status === "open" ? "default" : "secondary"} className={session.status === "open" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
            {session.status === "open" ? "Aberta" : "Encerrada"}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {submitted}/{total} avaliações
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onViewResults} title="Ver resultados">
          <Eye className="h-4 w-4" />
        </Button>
        {session.status === "open" ? (
          <Button variant="ghost" size="icon" onClick={onClose} title="Encerrar sessão">
            <Lock className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onOpen} title="Reabrir sessão">
            <Unlock className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} title="Excluir sessão">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
