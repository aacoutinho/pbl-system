import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Lock, Unlock, Trash2, ClipboardList, Users, Eye, BookOpen, KeyRound, Copy, RefreshCw, RotateCcw, CheckCircle2, Clock, FileSearch, AlertTriangle, Mail } from "lucide-react";
import { EvaluationPreviewDialog } from "@/components/EvaluationPreview";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();

  // Get the class info to check ownership
  const { data: classesList } = trpc.classes.list.useQuery();
  const { data: myComponents } = trpc.professors.myComponents.useQuery();

  const selectedClass = useMemo(() => {
    if (!classesList || !selectedClassId) return null;
    return classesList.find(c => c.id === selectedClassId) ?? null;
  }, [classesList, selectedClassId]);

  const isAdmin = user?.role === "admin";
  const isOwner = selectedClass?.professorUserId === user?.id;
  const isCoordinatorOfComponent = useMemo(() => {
    if (!selectedClass || !myComponents) return false;
    return myComponents.some(
      c => c.componentId === selectedClass.componentId && c.componentRole === "coordinator" && c.status === "approved"
    );
  }, [selectedClass, myComponents]);
  const canManage = isAdmin || isOwner || isCoordinatorOfComponent;

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
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão fechada"); },
  });
  const openMutation = trpc.sessions.open.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão reaberta"); },
  });
  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão removida"); },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredSessions = useMemo(() => {
    if (!sessionsList) return [];
    if (statusFilter === "all") return sessionsList;
    return sessionsList.filter(s => s.status === statusFilter);
  }, [sessionsList, statusFilter]);
  // Auto-numbering: fetch next session info
  const { data: nextInfo } = trpc.sessions.getNextInfo.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId && canManage }
  );

  const [problemNum, setProblemNum] = useState("1");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  // Auto-set problem number when nextInfo loads
  useEffect(() => {
    if (nextInfo) {
      setProblemNum(String(nextInfo.nextProblemNumber));
    }
  }, [nextInfo]);

  // Calculate auto session number based on problem selection
  const autoSessionNumber = useMemo(() => {
    if (!nextInfo) return 1;
    const pn = parseInt(problemNum);
    if (isNaN(pn)) return 1;
    if (pn === nextInfo.nextProblemNumber) return nextInfo.nextSessionNumber;
    if (pn === nextInfo.lastProblemNumber + 1) return 1;
    return 1;
  }, [nextInfo, problemNum]);

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
    if (isNaN(pn) || pn < 1) { toast.error("Número do problema inválido"); return; }
    if (selectedStudents.length === 0) { toast.error("Selecione ao menos um aluno"); return; }
    createMutation.mutate({
      classId: selectedClassId,
      problemNumber: pn,
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
          <p className="text-muted-foreground mt-1">
            {canManage ? "Crie e gerencie sessões de avaliação tutorial." : "Visualize as sessões de avaliação tutorial."}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}>
            <FileSearch className="h-4 w-4 mr-2" />Prévia do Formulário
          </Button>
          <EvaluationPreviewDialog open={showPreview} onOpenChange={setShowPreview} />
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
                    <Input
                      type="number"
                      min={nextInfo?.lastProblemNumber === 0 ? 1 : nextInfo?.lastProblemNumber ?? 1}
                      max={(nextInfo?.lastProblemNumber ?? 0) + 1}
                      value={problemNum}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && nextInfo) {
                          const minP = nextInfo.lastProblemNumber === 0 ? 1 : nextInfo.lastProblemNumber;
                          const maxP = nextInfo.lastProblemNumber + 1;
                          if (val >= minP && val <= maxP) {
                            setProblemNum(e.target.value);
                          }
                        } else {
                          setProblemNum(e.target.value);
                        }
                      }}
                      className="mt-1"
                    />
                    {nextInfo && nextInfo.lastProblemNumber > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Permitido: {nextInfo.lastProblemNumber} (continuar) ou {nextInfo.lastProblemNumber + 1} (novo)
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Sessão (automático)</Label>
                    <Input
                      type="number"
                      value={autoSessionNumber}
                      disabled
                      className="mt-1 bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculada automaticamente
                    </p>
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
                            <p className="text-xs text-muted-foreground truncate">{student.enrollment}</p>
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
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Sessões de Avaliação
              {sessionsList && <Badge variant="secondary" className="ml-2">{filteredSessions.length}/{sessionsList.length}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["all", "initiated", "open", "closed", "finished"].map(st => (
                <Button
                  key={st}
                  variant={statusFilter === st ? "default" : "outline"}
                  size="sm"
                  className={`h-7 text-xs ${statusFilter === st ? "" :
                    st === "initiated" ? "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200" :
                    st === "open" ? "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" :
                    st === "closed" ? "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200" :
                    st === "finished" ? "hover:bg-gray-100 hover:text-gray-600" : ""
                  }`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === "all" ? "Todas" : st === "initiated" ? "Iniciadas" : st === "open" ? "Abertas" : st === "closed" ? "Fechadas" : "Encerradas"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : !sessionsList || sessionsList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma sessão criada nesta turma.</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma sessão com o status selecionado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map(session => (
                <SessionRow
                  key={session.id}
                  session={session}
                  canManage={canManage}
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

function SessionRow({ session, canManage, onClose, onOpen, onDelete, onViewResults }: {
  session: { id: number; label: string; problemNumber: number; sessionNumber: number; status: string; accessCode?: string | null };
  canManage: boolean;
  onClose: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onViewResults: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: status } = trpc.sessions.submissionStatus.useQuery({ sessionId: session.id });
  const submitted = status?.filter(s => s.submitted).length ?? 0;
  const total = status?.length ?? 0;
  const pending = total - submitted;

  const [showReevalDialog, setShowReevalDialog] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);

  const generateCodeMutation = trpc.sessions.generateCode.useMutation({
    onSuccess: (data: { accessCode: string; emailsSent: number }) => {
      utils.sessions.list.invalidate();
      const emailMsg = data.emailsSent > 0
        ? ` ${data.emailsSent} e-mail(s) enviado(s) para alunos com e-mail cadastrado.`
        : " Nenhum aluno possui e-mail cadastrado.";
      toast.success(`Código gerado: ${data.accessCode}.${emailMsg}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const resendEmailsMutation = trpc.sessions.resendEmails.useMutation({
    onSuccess: (data: { emailsSent: number }) => {
      const msg = data.emailsSent > 0
        ? `${data.emailsSent} e-mail(s) reenviado(s) com sucesso.`
        : "Nenhum aluno possui e-mail cadastrado.";
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message),
  });

  const allowReevalMutation = trpc.evaluations.allowReevaluation.useMutation({
    onSuccess: () => {
      utils.sessions.submissionStatus.invalidate({ sessionId: session.id });
      toast.success("Reavaliação liberada! O aluno pode avaliar novamente.");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyCode = () => {
    if (session.accessCode) {
      navigator.clipboard.writeText(session.accessCode);
      toast.success("Código copiado!");
    }
  };

  const handleAllowReevaluation = (studentId: number) => {
    allowReevalMutation.mutate({ sessionId: session.id, studentId });
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{session.label}</p>
          <Badge variant={session.status === "open" ? "default" : "secondary"} className={
            session.status === "initiated" ? "bg-blue-100 text-blue-700 border-blue-200" :
            session.status === "open" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
            session.status === "closed" ? "bg-amber-100 text-amber-700 border-amber-200" :
            session.status === "finished" ? "bg-gray-100 text-gray-600 border-gray-200" : ""
          }>
            {session.status === "initiated" ? "Iniciada" :
             session.status === "open" ? "Aberta" :
             session.status === "closed" ? "Fechada" :
             session.status === "finished" ? "Encerrada" : session.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{submitted}/{total}</span>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  total > 0 && submitted === total
                    ? "bg-emerald-500"
                    : submitted > 0
                    ? "bg-blue-500"
                    : "bg-muted-foreground/20"
                }`}
                style={{ width: total > 0 ? `${(submitted / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
          {session.accessCode ? (
            <span className="flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" />
              Código: <strong className="font-mono text-foreground tracking-wider">{session.accessCode}</strong>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyCode} title="Copiar código">
                <Copy className="h-3 w-3" />
              </Button>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canManage && (session.status === "initiated" || session.status === "open") && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => generateCodeMutation.mutate({ sessionId: session.id, origin: window.location.origin })}
            disabled={generateCodeMutation.isPending}
            title={session.accessCode ? "Regenerar código de acesso" : "Gerar código de acesso"}
          >
            {session.accessCode ? <RefreshCw className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          </Button>
        )}
        {canManage && session.status === "open" && session.accessCode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => resendEmailsMutation.mutate({ sessionId: session.id, origin: window.location.origin })}
            disabled={resendEmailsMutation.isPending}
            title="Reenviar e-mails aos alunos"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}

        {/* Reevaluation dialog - only for managers */}
        {canManage && (
          <Dialog open={showReevalDialog} onOpenChange={setShowReevalDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Gerenciar avaliações / Liberar reavaliação" disabled={submitted === 0}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Avaliações da Sessão</DialogTitle>
                <DialogDescription>
                  {session.label} — {submitted}/{total} alunos avaliaram. Libere a reavaliação para permitir que um aluno envie novamente.
                </DialogDescription>
              </DialogHeader>
              <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
                {status?.map(s => (
                  <div key={s.studentId} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {s.submitted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.studentName}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.studentEnrollment}</p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      {s.submitted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleAllowReevaluation(s.studentId)}
                          disabled={allowReevalMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Liberar
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Pendente</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {(!status || status.length === 0) && (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhum aluno nesta sessão.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Button variant="ghost" size="icon" onClick={onViewResults} title="Ver resultados">
          <Eye className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            {session.status === "open" ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowCloseConfirm(true)} title="Fechar sessão">
                  <Lock className="h-4 w-4" />
                </Button>
                <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Fechar Sessão</DialogTitle>
                      <DialogDescription>
                        Confirme o fechamento da sessão <strong>{session.label}</strong>.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-accent/30 border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avaliações recebidas:</span>
                          <span className="font-semibold">{submitted}/{total}</span>
                        </div>
                        {pending > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span><strong>{pending} aluno(s)</strong> ainda não avaliaram.</span>
                          </div>
                        )}
                        {pending === 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-emerald-700 bg-emerald-50 rounded-md p-2 border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Todos os alunos já avaliaram.</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Após fechar, os alunos não poderão mais enviar avaliações. Você poderá submeter a avaliação do tutor.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>Cancelar</Button>
                      <Button onClick={() => { onClose(); setShowCloseConfirm(false); }}>Fechar Sessão</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : session.status === "closed" || session.status === "finished" ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowOpenConfirm(true)} title="Reabrir sessão">
                  <Unlock className="h-4 w-4" />
                </Button>
                <Dialog open={showOpenConfirm} onOpenChange={setShowOpenConfirm}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reabrir Sessão</DialogTitle>
                      <DialogDescription>
                        Confirme a reabertura da sessão <strong>{session.label}</strong>.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-accent/30 border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avaliações recebidas:</span>
                          <span className="font-semibold">{submitted}/{total}</span>
                        </div>
                        {session.status === "finished" && (
                          <div className="flex items-center gap-1.5 mt-2 text-sm text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>A avaliação do tutor já foi submetida. Reabrir mudará o status para <strong>Aberta</strong>.</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ao reabrir, os alunos poderão enviar (ou reenviar) avaliações novamente.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowOpenConfirm(false)}>Cancelar</Button>
                      <Button onClick={() => { onOpen(); setShowOpenConfirm(false); }}>Reabrir Sessão</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} title="Excluir sessão">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
