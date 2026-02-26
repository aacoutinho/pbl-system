import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Lock, Unlock, Trash2, ClipboardList, Users, Eye, BookOpen, RotateCcw, CheckCircle2, Clock, FileSearch, AlertTriangle, Mail, Send, Pencil, Lightbulb } from "lucide-react";
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
  const { data: roleSummary } = trpc.sessions.roleSummary.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId && canManage }
  );
  const [showRoleSummary, setShowRoleSummary] = useState(false);

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.sessions.getNextInfo.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão criada com sucesso"); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });
  const closeMutation = trpc.sessions.close.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão fechada"); },
  });
  const openMutation = trpc.sessions.open.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão reaberta"); },
  });
  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.sessions.getNextInfo.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão removida"); },
  });
  const finishMutation = trpc.sessions.finish.useMutation({
    onSuccess: () => { utils.sessions.list.invalidate(); utils.results.dashboard.invalidate(); toast.success("Sessão encerrada"); },
    onError: (e) => toast.error(e.message),
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

  type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";
  interface StudentAssignment { studentId: number; role: RoleType; absent: boolean; selected: boolean; }
  const [problemNum, setProblemNum] = useState("1");
  const [problemTitle, setProblemTitle] = useState("");
  const [assignments, setAssignments] = useState<Record<number, StudentAssignment>>({});

  // Initialize assignments when studentsList loads
  useMemo(() => {
    if (studentsList && Object.keys(assignments).length === 0) {
      const init: Record<number, StudentAssignment> = {};
      studentsList.forEach(s => {
        init[s.id] = { studentId: s.id, role: "PARTICIPANTE", absent: false, selected: true };
      });
      setAssignments(init);
    }
  }, [studentsList]);

  const selectedStudents = useMemo(() => Object.values(assignments).filter(a => a.selected), [assignments]);

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
    const selected = Object.values(assignments).filter(a => a.selected);
    if (selected.length === 0) { toast.error("Selecione ao menos um aluno"); return; }
    // Validate exclusive roles
    const exclusiveRoles: RoleType[] = ["COORDENADOR", "MESA", "QUADRO"];
    for (const role of exclusiveRoles) {
      const count = selected.filter(sa => sa.role === role && !sa.absent).length;
      if (count > 1) { toast.error(`O papel ${role} só pode ser atribuído a um aluno`); return; }
    }
    // Validate required roles
    const presentRoles = selected.filter(sa => !sa.absent).map(sa => sa.role);
    if (!presentRoles.includes("COORDENADOR")) { toast.error("É necessário atribuir o papel de Coordenador a um aluno presente."); return; }
    if (!presentRoles.includes("MESA")) { toast.error("É necessário atribuir o papel de Mesa a um aluno presente."); return; }
    if (!presentRoles.includes("QUADRO")) { toast.error("É necessário atribuir o papel de Quadro a um aluno presente."); return; }
    createMutation.mutate({
      classId: selectedClassId,
      problemNumber: pn,
      problemTitle: problemTitle.trim() || undefined,
      studentAssignments: selected.map(sa => ({ studentId: sa.studentId, role: sa.role, absent: sa.absent })),
      origin: window.location.origin,
    });
  };

  // Preview label
  const previewLabel = useMemo(() => {
    const pn = parseInt(problemNum);
    if (isNaN(pn)) return "";
    const titlePart = problemTitle.trim() ? ` - ${problemTitle.trim()}` : "";
    return `Problema ${pn}${titlePart} - Sessão ${autoSessionNumber}`;
  }, [problemNum, problemTitle, autoSessionNumber]);

  const toggleStudent = (id: number) => {
    setAssignments(prev => ({ ...prev, [id]: { ...prev[id], selected: !prev[id]?.selected } }));
  };

  const updateRole = (id: number, role: RoleType) => {
    // If exclusive role, remove from other students
    if (["COORDENADOR", "MESA", "QUADRO"].includes(role)) {
      setAssignments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          const kid = Number(k);
          if (kid !== id && updated[kid].role === role) {
            updated[kid] = { ...updated[kid], role: "PARTICIPANTE" };
          }
        });
        updated[id] = { ...updated[id], role };
        return updated;
      });
    } else {
      setAssignments(prev => ({ ...prev, [id]: { ...prev[id], role } }));
    }
  };

  const toggleAbsent = (id: number) => {
    setAssignments(prev => ({ ...prev, [id]: { ...prev[id], absent: !prev[id]?.absent } }));
  };

  const selectAll = () => {
    if (studentsList) {
      const allSelected = selectedStudents.length === studentsList.length;
      setAssignments(prev => {
        const updated = { ...prev };
        studentsList.forEach(s => {
          updated[s.id] = { ...updated[s.id], selected: !allSelected };
        });
        return updated;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessões</h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? "Crie e gerencie sessões tutoriais." : "Visualize as sessões tutoriais."}
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
                      max={nextInfo?.lastProblemNumber === 0 ? 1 : (nextInfo?.lastProblemNumber ?? 0) + 1}
                      value={problemNum}
                      disabled={nextInfo?.lastProblemNumber === 0}
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
                      className={`mt-1 ${nextInfo?.lastProblemNumber === 0 ? 'bg-muted' : ''}`}
                    />
                    {nextInfo && nextInfo.lastProblemNumber === 0 && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        Primeira sessão: obrigatoriamente Problema 1
                      </p>
                    )}
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
                  <Label>Título/Tema do Problema (opcional)</Label>
                  <Input
                    placeholder="Ex: Febre Reumática, Diabetes Mellitus..."
                    value={problemTitle}
                    onChange={e => setProblemTitle(e.target.value)}
                    maxLength={255}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Opcional: dê um nome ao problema para facilitar a identificação
                  </p>
                </div>
                {previewLabel && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-xs font-medium text-blue-700 mb-1">Prévia da sessão:</p>
                    <p className="text-sm font-semibold text-blue-900">{previewLabel}</p>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Alunos da Sessão (presença e papéis)</Label>
                    <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                      {selectedStudents.length === (studentsList?.length ?? 0) ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Alunos não selecionados receberão falta. Defina o papel de cada aluno presente.</p>
                  <div className="border rounded-lg max-h-72 overflow-y-auto divide-y">
                    {!studentsList || studentsList.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">Nenhum aluno cadastrado. Cadastre alunos primeiro.</p>
                    ) : (
                      studentsList.map(student => {
                        const a = assignments[student.id];
                        if (!a) return null;
                        return (
                          <div key={student.id} className={`px-3 py-2.5 transition-colors ${a.selected ? 'bg-background' : 'bg-muted/30 opacity-60'}`}>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={a.selected}
                                onCheckedChange={() => toggleStudent(student.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{student.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{student.enrollment}</p>
                              </div>
                              {a.selected && (
                                <Select value={a.role} onValueChange={(v) => updateRole(student.id, v as RoleType)}>
                                  <SelectTrigger className="w-[140px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PARTICIPANTE">Participante</SelectItem>
                                    <SelectItem value="COORDENADOR">Coordenador</SelectItem>
                                    <SelectItem value="MESA">Mesa</SelectItem>
                                    <SelectItem value="QUADRO">Quadro</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{selectedStudents.length} presente(s), {(studentsList?.length ?? 0) - selectedStudents.length} falta(s)</p>
                    <div className="flex gap-1">
                      {Object.values(assignments).filter(a => a.selected && a.role !== "PARTICIPANTE").map(a => (
                        <Badge key={a.role} variant="outline" className="text-[10px] h-5">{a.role}</Badge>
                      ))}
                    </div>
                  </div>
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
              Sessões Tutoriais Realizadas
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
                  {st === "all" ? "Todas" : st === "initiated" ? "Ativas" : st === "open" ? "Em Avaliação" : st === "closed" ? "Fechadas" : "Encerradas"}
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
              {filteredSessions.map(session => {
                // Determine if this is the last session (highest problem + session number)
                const lastSession = sessionsList ? sessionsList.reduce((last, s) => {
                  if (s.problemNumber > last.problemNumber || (s.problemNumber === last.problemNumber && s.sessionNumber > last.sessionNumber)) return s;
                  return last;
                }, sessionsList[0]) : null;
                const isLast = lastSession ? session.id === lastSession.id : false;
                return (
                <SessionRow
                  key={session.id}
                  session={session}
                  canManage={canManage}
                  isLastSession={isLast}
                  onClose={() => closeMutation.mutate({ id: session.id })}
                  onOpen={() => openMutation.mutate({ id: session.id, origin: window.location.origin })}
                  onFinish={() => finishMutation.mutate({ id: session.id })}
                  onDelete={() => { if (confirm(`Excluir "${session.label}"? Todas as avaliações serão perdidas.`)) deleteMutation.mutate({ id: session.id }); }}
                  onViewResults={() => setLocation(`/results?session=${session.id}`)}
                />);
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Summary Card */}
      {canManage && roleSummary && roleSummary.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowRoleSummary(!showRoleSummary)}>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resumo de Papéis por Aluno
              <Badge variant="secondary" className="ml-2">{roleSummary.length} alunos</Badge>
              <span className="ml-auto text-sm font-normal text-muted-foreground">{showRoleSummary ? "Ocultar" : "Expandir"}</span>
            </CardTitle>
          </CardHeader>
          {showRoleSummary && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Histórico de papéis assumidos em todas as sessões desta turma. Use para distribuir papéis de forma equilibrada.
              </p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Aluno</th>
                      <th className="text-center px-2 py-2 font-medium text-blue-700" title="Coordenador">Coord.</th>
                      <th className="text-center px-2 py-2 font-medium text-emerald-700" title="Mesa">Mesa</th>
                      <th className="text-center px-2 py-2 font-medium text-purple-700" title="Quadro">Quadro</th>
                      <th className="text-center px-2 py-2 font-medium text-gray-600" title="Participante">Part.</th>
                      <th className="text-center px-2 py-2 font-medium text-red-600" title="Ausências">Faltas</th>
                      <th className="text-center px-2 py-2 font-medium" title="Total de sessões">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleSummary.map(s => {
                      const hasNoSpecialRole = s.coordenador === 0 && s.mesa === 0 && s.quadro === 0;
                      return (
                        <tr key={s.studentId} className={`border-b last:border-0 ${hasNoSpecialRole ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{s.studentName}</p>
                              <p className="text-xs text-muted-foreground">{s.studentEnrollment}</p>
                            </div>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${s.coordenador > 0 ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground/40'}`}>
                              {s.coordenador}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${s.mesa > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-muted-foreground/40'}`}>
                              {s.mesa}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${s.quadro > 0 ? 'bg-purple-100 text-purple-700' : 'text-muted-foreground/40'}`}>
                              {s.quadro}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className="text-muted-foreground">{s.participante}</span>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={s.ausencias > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground/40'}>{s.ausencias}</span>
                          </td>
                          <td className="text-center px-2 py-2 font-medium">{s.totalSessions}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {roleSummary.some(s => s.coordenador === 0 && s.mesa === 0 && s.quadro === 0) && (
                <div className="flex items-center gap-2 mt-3 text-sm text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Alunos destacados em amarelo ainda não assumiram nenhum papel especial (Coordenador, Mesa ou Quadro).</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

type RoleTypeRow = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

function SessionRow({ session, canManage, isLastSession, onClose, onOpen, onFinish, onDelete, onViewResults }: {
  session: { id: number; label: string; problemNumber: number; sessionNumber: number; status: string; accessCode?: string | null };
  canManage: boolean;
  isLastSession: boolean;
  onClose: () => void;
  onOpen: () => void;
  onFinish: () => void;
  onDelete: () => void;
  onViewResults: () => void;
}) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: status } = trpc.sessions.submissionStatus.useQuery({ sessionId: session.id });
  const submitted = status?.filter(s => s.submitted).length ?? 0;
  const total = status?.length ?? 0;
  const pending = total - submitted;

  const [showReevalDialog, setShowReevalDialog] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showEditAssignments, setShowEditAssignments] = useState(false);
  const [editAssignments, setEditAssignments] = useState<Record<number, { studentId: number; role: RoleTypeRow; absent: boolean }>>({});

  const { data: sessionStudentsData } = trpc.sessions.getStudents.useQuery(
    { sessionId: session.id },
    { enabled: showEditAssignments }
  );

  const updateAssignmentsMutation = trpc.sessions.updateAssignments.useMutation({
    onSuccess: () => {
      utils.sessions.submissionStatus.invalidate({ sessionId: session.id });
      utils.sessions.getStudents.invalidate({ sessionId: session.id });
      toast.success("Papéis e presença atualizados com sucesso!");
      setShowEditAssignments(false);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // Initialize edit assignments when data loads
  useEffect(() => {
    if (sessionStudentsData && showEditAssignments) {
      const init: Record<number, { studentId: number; role: RoleTypeRow; absent: boolean }> = {};
      sessionStudentsData.forEach((s: any) => {
        init[s.studentId] = { studentId: s.studentId, role: s.role ?? "PARTICIPANTE", absent: s.absent ?? false };
      });
      setEditAssignments(init);
    }
  }, [sessionStudentsData, showEditAssignments]);

  const updateEditRole = (studentId: number, role: RoleTypeRow) => {
    if (["COORDENADOR", "MESA", "QUADRO"].includes(role)) {
      setEditAssignments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          const kid = Number(k);
          if (kid !== studentId && updated[kid].role === role) {
            updated[kid] = { ...updated[kid], role: "PARTICIPANTE" };
          }
        });
        updated[studentId] = { ...updated[studentId], role };
        return updated;
      });
    } else {
      setEditAssignments(prev => ({ ...prev, [studentId]: { ...prev[studentId], role } }));
    }
  };

  const toggleEditAbsent = (studentId: number) => {
    setEditAssignments(prev => ({ ...prev, [studentId]: { ...prev[studentId], absent: !prev[studentId]?.absent } }));
  };

  const handleSaveAssignments = () => {
    const assignments = Object.values(editAssignments);
    const presentRoles = assignments.filter(a => !a.absent).map(a => a.role);
    if (!presentRoles.includes("COORDENADOR")) { toast.error("É necessário um Coordenador entre os presentes."); return; }
    if (!presentRoles.includes("MESA")) { toast.error("É necessário um aluno de Mesa entre os presentes."); return; }
    if (!presentRoles.includes("QUADRO")) { toast.error("É necessário um aluno de Quadro entre os presentes."); return; }
    updateAssignmentsMutation.mutate({ sessionId: session.id, studentAssignments: assignments });
  };

  const openAndNotifyMutation = trpc.sessions.openAndNotify.useMutation({
    onSuccess: (data: { emailsSent: number; tokensGenerated: number }) => {
      utils.sessions.list.invalidate();
      const emailMsg = data.emailsSent > 0
        ? ` ${data.emailsSent} e-mail(s) enviado(s) com link individual.`
        : " Nenhum aluno possui e-mail cadastrado.";
      toast.success(`Sessão aberta! ${data.tokensGenerated} link(s) gerado(s).${emailMsg}`);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const resendEmailsMutation = trpc.sessions.resendEmails.useMutation({
    onSuccess: (data: { emailsSent: number }) => {
      const msg = data.emailsSent > 0
        ? `${data.emailsSent} e-mail(s) reenviado(s) com sucesso.`
        : "Nenhum aluno possui e-mail cadastrado.";
      toast.success(msg);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const allowReevalMutation = trpc.evaluations.allowReevaluation.useMutation({
    onSuccess: () => {
      utils.sessions.submissionStatus.invalidate({ sessionId: session.id });
      toast.success("Reavaliação liberada! O aluno pode avaliar novamente.");
    },
    onError: (e) => toast.error(e.message),
  });



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
            {session.status === "initiated" ? "Ativa" :
             session.status === "open" ? "Em Avaliação" :
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

        </div>
      </div>
      <div className="flex items-center gap-1">
        {canManage && session.status === "initiated" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openAndNotifyMutation.mutate({ sessionId: session.id, origin: window.location.origin })}
            disabled={openAndNotifyMutation.isPending}
            title="Iniciar Avaliação — gerar código de acesso e enviar links aos alunos"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
        {canManage && session.status === "open" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => resendEmailsMutation.mutate({ sessionId: session.id, origin: window.location.origin })}
            disabled={resendEmailsMutation.isPending}
            title="Reenviar links de avaliação por e-mail"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
        {(session.status === "initiated" || session.status === "open" || session.status === "closed" || session.status === "finished") && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/brainstorm/${session.id}`)}
            title="Quadro de Brainstorming da sessão"
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
        )}

        {/* Reevaluation dialog - only for managers */}
        {canManage && (
          <Dialog open={showReevalDialog} onOpenChange={setShowReevalDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Gerenciar avaliações — ver status e liberar reavaliação" disabled={submitted === 0}>
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

        {/* Edit assignments button */}
        {canManage && session.status === "initiated" && (
          <Dialog open={showEditAssignments} onOpenChange={setShowEditAssignments}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title={session.status === "initiated" ? "Editar papéis e presença dos alunos" : "Papéis bloqueados — só editável no estado Ativa"}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar Papéis e Presença</DialogTitle>
                <DialogDescription>
                  {session.label} — Ajuste os papéis e presença dos alunos.
                </DialogDescription>
              </DialogHeader>
              <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
                {sessionStudentsData?.map((s: any) => {
                  const a = editAssignments[s.studentId];
                  if (!a) return null;
                  return (
                    <div key={s.studentId} className={`px-3 py-2.5 transition-colors ${a.absent ? 'bg-muted/30 opacity-60' : 'bg-background'}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!a.absent}
                          onCheckedChange={() => toggleEditAbsent(s.studentId)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.studentName}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.studentEnrollment}</p>
                        </div>
                        {!a.absent && (
                          <Select value={a.role} onValueChange={(v) => updateEditRole(s.studentId, v as RoleTypeRow)}>
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PARTICIPANTE">Participante</SelectItem>
                              <SelectItem value="COORDENADOR">Coordenador</SelectItem>
                              <SelectItem value="MESA">Mesa</SelectItem>
                              <SelectItem value="QUADRO">Quadro</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {a.absent && <Badge variant="outline" className="text-xs text-red-600">Falta</Badge>}
                      </div>
                    </div>
                  );
                })}
                {(!sessionStudentsData || sessionStudentsData.length === 0) && (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhum aluno nesta sessão.</p>
                )}
              </div>
              {sessionStudentsData && sessionStudentsData.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Object.values(editAssignments).filter(a => !a.absent).length} presente(s), {Object.values(editAssignments).filter(a => a.absent).length} falta(s)</span>
                  <div className="flex gap-1">
                    {Object.values(editAssignments).filter(a => !a.absent && a.role !== "PARTICIPANTE").map(a => (
                      <Badge key={a.role} variant="outline" className="text-[10px] h-5">{a.role}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditAssignments(false)}>Cancelar</Button>
                <Button onClick={handleSaveAssignments} disabled={updateAssignmentsMutation.isPending}>
                  {updateAssignmentsMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Button variant="ghost" size="icon" onClick={onViewResults} title="Ver resultados da sessão">
          <Eye className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            {session.status === "open" ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowCloseConfirm(true)} title="Fechar sessão — impedir novas avaliações">
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
            ) : session.status === "closed" ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowFinishConfirm(true)} title="Encerrar sessão — finalizar e bloquear alterações">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
                <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Encerrar Sessão</DialogTitle>
                      <DialogDescription>
                        Confirme o encerramento da sessão <strong>{session.label}</strong>.
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
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ao encerrar, a sessão será marcada como finalizada e nenhum dado poderá ser alterado. Os resultados poderão ser consultados na página de Resultados.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>Cancelar</Button>
                      <Button onClick={() => { onFinish(); setShowFinishConfirm(false); }}>Encerrar Sessão</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="icon" onClick={() => setShowOpenConfirm(true)} title="Reabrir sessão — voltar para Em Avaliação">
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
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ao reabrir, a sessão voltará para o estado <strong>Em Avaliação</strong> e os alunos poderão enviar (ou reenviar) avaliações.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowOpenConfirm(false)}>Cancelar</Button>
                      <Button onClick={() => { onOpen(); setShowOpenConfirm(false); }}>Reabrir Sessão</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : session.status === "finished" ? (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowOpenConfirm(true)} title="Reabrir sessão — voltar para Em Avaliação">
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
                        <div className="flex items-center gap-1.5 mt-2 text-sm text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>A sessão está encerrada. Reabrir mudará o status para <strong>Em Avaliação</strong> e permitirá alterações novamente.</span>
                        </div>
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
            <Button
              variant="ghost"
              size="icon"
              className={isLastSession ? "text-destructive hover:text-destructive" : "text-muted-foreground/40 cursor-not-allowed"}
              onClick={isLastSession ? onDelete : undefined}
              disabled={!isLastSession}
              title={isLastSession ? "Excluir sessão" : "Só a última sessão pode ser excluída"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
