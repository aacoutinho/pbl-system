import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useComponentContext } from "@/contexts/ComponentContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BookOpen, ClipboardCheck, Save, CheckCircle2, Info, ShieldCheck, ShieldAlert, Crown, UserCheck, FileEdit, SendHorizonal, ThumbsUp, ThumbsDown, MessageSquare, User, Lightbulb, ExternalLink, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

// Rótulos com conceitos descritivos (feminino e masculino)
const LABELS = [
  { label: "Nenhuma", value: 0 },
  { label: "Fraca", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Boa", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const LABELS_MASC = [
  { label: "Nenhum", value: 0 },
  { label: "Fraco", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

function getLabelForValue(value: number, gender: "fem" | "masc"): string {
  const labels = gender === "masc" ? LABELS_MASC : LABELS;
  const match = labels.find(l => Math.abs(l.value - value) < 0.01);
  return match?.label ?? `${value.toFixed(2)}`;
}

const CRITERIA = [
  {
    key: "organizacao" as const,
    label: "Organização",
    weight: 1,
    gender: "fem" as const,
    description: "Disposição do quadro, fluência da discussão em sala e qualidade das notas de tutorial publicadas da sessão.",
  },
  {
    key: "cooperacao" as const,
    label: "Cooperação",
    weight: 1,
    gender: "fem" as const,
    description: "Existência de troca de ideias ou divisão de tarefas de forma produtiva entre os alunos na sessão tutorial.",
  },
  {
    key: "conteudo" as const,
    label: "Discussão",
    weight: 3,
    gender: "fem" as const,
    description: "As ideias, fatos e questões abordadas na sessão estavam coerentes, bem apresentadas e adequadas aos objetivos do problema.",
  },
  {
    key: "objetivo" as const,
    label: "Progresso",
    weight: 3,
    gender: "masc" as const,
    description: "Resultado alcançado pelo produto em relação às metas estipuladas até a presente sessão tutorial.",
  },
  {
    key: "metas" as const,
    label: "Metas",
    weight: 2,
    gender: "fem" as const,
    description: "As metas definidas para a próxima sessão tutorial estão contribuindo para a devida resolução do problema.",
  },
];

type CriteriaKey = typeof CRITERIA[number]["key"];

const DEFAULT_SCORES: Record<CriteriaKey, number> = {
  organizacao: 1.0,
  cooperacao: 1.0,
  conteudo: 1.0,
  objetivo: 1.0,
  metas: 1.0,
};

type EvalPermission = "owner" | "coordinator" | "authorized" | "no_permission" | "admin";

type StudentNote = {
  studentId: number;
  positivePoints: number;
  negativePoints: number;
  positiveTexts: string[];
  negativeTexts: string[];
  notes: string;
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    initiated: { label: "Ativa", className: "bg-gray-100 text-gray-700 border-gray-300" },
    open: { label: "Em Avaliação", className: "bg-blue-50 text-blue-700 border-blue-200" },
    closed: { label: "Fechada", className: "bg-amber-50 text-amber-700 border-amber-200" },
    finished: { label: "Encerrada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const c = config[status] ?? { label: status, className: "" };
  return <Badge variant="outline" className={cn("text-xs", c.className)}>{c.label}</Badge>;
}

function PermissionBadge({ permission }: { permission: EvalPermission }) {
  switch (permission) {
    case "owner":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1">
          <Crown className="h-3 w-3" />
          Sua turma
        </Badge>
      );
    case "coordinator":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1">
          <ShieldCheck className="h-3 w-3" />
          Coordenador
        </Badge>
      );
    case "authorized":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
          <UserCheck className="h-3 w-3" />
          Autorizado
        </Badge>
      );
    case "no_permission":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs gap-1">
          <ShieldAlert className="h-3 w-3" />
          Sem permissão
        </Badge>
      );
    case "admin":
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs gap-1">
          <ShieldCheck className="h-3 w-3" />
          Admin
        </Badge>
      );
    default:
      return null;
  }
}

// ─── Point bar component ───
function PointBar({ value, max, color, onChange, disabled }: {
  value: number;
  max: number;
  color: "green" | "red";
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const colorClasses = color === "green"
    ? { active: "bg-emerald-500", hover: "hover:bg-emerald-200", inactive: "bg-gray-200" }
    : { active: "bg-red-500", hover: "hover:bg-red-200", inactive: "bg-gray-200" };

  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          className={cn(
            "w-6 h-6 rounded-sm transition-all text-xs font-medium",
            disabled ? "cursor-default" : "cursor-pointer",
            i < value ? `${colorClasses.active} text-white` : `${colorClasses.inactive} ${!disabled ? colorClasses.hover : ""}`,
          )}
          title={`${i + 1} ponto${i > 0 ? "s" : ""}`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export default function TutorialEvalPage() {
  return <TutorialEvalContent />;
}

function TutorialEvalContent() {
  const { selectedComponentId, selectedComponentFullLabel } = useComponentContext();
  const { user } = useAuth();
  const utils = trpc.useUtils();

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

  // Class filter
  const { data: classesList } = trpc.classes.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );
  const professorClass = classesList?.find((c: any) => c.professorUserId === user?.id);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  useEffect(() => {
    if (classesList && selectedClassId === null) {
      setSelectedClassId(professorClass?.id ?? classesList[0]?.id ?? null);
    }
  }, [classesList]);
  useEffect(() => { setSelectedClassId(null); }, [selectedComponentId, selectedSemester]);

  // Sessions with permissions for the selected class
  const { data: sessionsWithPerms, isLoading: sessionsLoading } = trpc.sessions.listWithPermissions.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  const effectiveSessions = sessionsWithPerms?.filter(s =>
    ["initiated", "open", "closed"].includes(s.status)
  );
  const isLoadingSessions = sessionsLoading;

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  useEffect(() => { setSelectedSessionId(""); }, [selectedClassId]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId || !effectiveSessions) return null;
    return effectiveSessions.find(s => String(s.id) === selectedSessionId) ?? null;
  }, [selectedSessionId, effectiveSessions]);

  const canEvaluateSelected = selectedSession
    ? selectedSession.evalPermission !== "no_permission"
    : false;

  const sessionIdNum = selectedSessionId ? parseInt(selectedSessionId) : 0;

  const { data: existingEval, isLoading: evalLoading } = trpc.tutorialEval.get.useQuery(
    { sessionId: sessionIdNum },
    { enabled: !!selectedSessionId }
  );

  const { data: existingDraft, isLoading: draftLoading } = trpc.tutorialEval.getDraft.useQuery(
    { sessionId: sessionIdNum },
    { enabled: !!selectedSessionId && canEvaluateSelected }
  );

  // Session students (for per-student notes)
  const { data: sessionStudents } = trpc.sessions.getStudents.useQuery(
    { sessionId: sessionIdNum },
    { enabled: !!selectedSessionId && canEvaluateSelected }
  );

  // Existing professor notes for this session
  const { data: existingStudentNotes } = trpc.tutorialEval.getStudentNotes.useQuery(
    { sessionId: sessionIdNum },
    { enabled: !!selectedSessionId && canEvaluateSelected }
  );

  const [scores, setScores] = useState<Record<CriteriaKey, number>>({ ...DEFAULT_SCORES });
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  // Per-student notes state
  const [studentNotes, setStudentNotes] = useState<Record<number, StudentNote>>({});
  const studentNotesRef = useRef(studentNotes);
  studentNotesRef.current = studentNotes;
  const notesAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which session was last loaded to avoid overwriting local edits
  // when tRPC refetches data for the same session
  const lastLoadedSessionRef = useRef<string>("");
  const hasUserEditedRef = useRef(false);

  // Load existing evaluation or draft ONLY when session changes
  useEffect(() => {
    const sessionChanged = lastLoadedSessionRef.current !== selectedSessionId;
    
    if (existingEval) {
      // Always load finalized evaluations (read-only state)
      setScores({
        organizacao: Number(existingEval.organizacao),
        cooperacao: Number(existingEval.cooperacao),
        conteudo: Number(existingEval.conteudo),
        objetivo: Number(existingEval.objetivo),
        metas: Number(existingEval.metas),
      });
      setHasDraft(false);
      hasUserEditedRef.current = false;
    } else if (sessionChanged) {
      // Only load draft/defaults when switching to a different session
      if (existingDraft) {
        setScores({
          organizacao: Number(existingDraft.organizacao),
          cooperacao: Number(existingDraft.cooperacao),
          conteudo: Number(existingDraft.conteudo),
          objetivo: Number(existingDraft.objetivo),
          metas: Number(existingDraft.metas),
        });
        setHasDraft(true);
      } else {
        setScores({ ...DEFAULT_SCORES });
        setHasDraft(false);
      }
      hasUserEditedRef.current = false;
    }
    // If same session and user has edited, do NOT overwrite local scores
    
    if (sessionChanged) {
      setLastAutoSaved(null);
      lastLoadedSessionRef.current = selectedSessionId;
    }
  }, [existingEval, existingDraft, selectedSessionId]);

  // Load existing student notes
  useEffect(() => {
    if (existingStudentNotes && existingStudentNotes.length > 0) {
      const notesMap: Record<number, StudentNote> = {};
      for (const n of existingStudentNotes) {
        notesMap[n.studentId] = {
          studentId: n.studentId,
          positivePoints: n.positivePoints,
          negativePoints: n.negativePoints,
          positiveTexts: (n.positiveTexts as string[] | null) ?? Array(10).fill(""),
          negativeTexts: (n.negativeTexts as string[] | null) ?? Array(10).fill(""),
          notes: n.notes ?? "",
        };
      }
      setStudentNotes(notesMap);
    } else {
      setStudentNotes({});
    }
  }, [existingStudentNotes, selectedSessionId]);

  // Draft save mutation
  // IMPORTANT: Do NOT invalidate getDraft on auto-save success.
  // Invalidating causes the useEffect to re-run and overwrite the local scores
  // with stale server data, causing the "last button deselecting" bug.
  const saveDraftMutation = trpc.tutorialEval.saveDraft.useMutation({
    onSuccess: () => {
      setDraftSaving(false);
      setLastAutoSaved(new Date());
      setHasDraft(true);
    },
    onError: () => {
      setDraftSaving(false);
    },
  });

  // Student notes save mutation
  // IMPORTANT: Do NOT invalidate on auto-save to prevent overwriting local state
  const saveStudentNotesMutation = trpc.tutorialEval.saveStudentNotes.useMutation({});

  // Auto-save debounced (2 seconds after last change)
  const triggerAutoSave = useCallback(() => {
    if (!selectedSessionId || !canEvaluateSelected || existingEval) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setDraftSaving(true);
      saveDraftMutation.mutate({
        sessionId: sessionIdNum,
        ...scoresRef.current,
      });
    }, 2000);
  }, [selectedSessionId, canEvaluateSelected, existingEval, sessionIdNum]);

  // Auto-save student notes (3 seconds debounce)
  const triggerNotesAutoSave = useCallback(() => {
    if (!selectedSessionId || !canEvaluateSelected) return;
    if (notesAutoSaveTimerRef.current) clearTimeout(notesAutoSaveTimerRef.current);
    notesAutoSaveTimerRef.current = setTimeout(() => {
      const notesArray = Object.values(studentNotesRef.current).filter(
        n => n.positivePoints > 0 || n.negativePoints > 0 || n.notes.trim().length > 0 || (n.positiveTexts && n.positiveTexts.some(t => t.trim().length > 0)) || (n.negativeTexts && n.negativeTexts.some(t => t.trim().length > 0))
      );
      if (notesArray.length > 0) {
        saveStudentNotesMutation.mutate({
          sessionId: sessionIdNum,
          notes: notesArray.map(n => ({
            studentId: n.studentId,
            positivePoints: n.positivePoints,
            negativePoints: n.negativePoints,
            positiveTexts: n.positiveTexts ?? [],
            negativeTexts: n.negativeTexts ?? [],
            notes: n.notes || null,
          })),
        });
      }
    }, 3000);
  }, [selectedSessionId, canEvaluateSelected, sessionIdNum]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (notesAutoSaveTimerRef.current) clearTimeout(notesAutoSaveTimerRef.current);
    };
  }, []);

  const handleScoreChange = (key: CriteriaKey, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
    hasUserEditedRef.current = true;
    if (!existingEval) {
      triggerAutoSave();
    }
  };

  const handleStudentNoteChange = (studentId: number, field: keyof StudentNote, value: number | string) => {
    setStudentNotes(prev => {
      const existing = prev[studentId] ?? { studentId, positivePoints: 0, negativePoints: 0, notes: "" };
      return { ...prev, [studentId]: { ...existing, [field]: value } };
    });
    triggerNotesAutoSave();
  };

  // Submit (finalize) mutation
  const submitMutation = trpc.tutorialEval.submit.useMutation({
    onSuccess: () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      utils.tutorialEval.get.invalidate();
      utils.tutorialEval.getDraft.invalidate();
      utils.sessions.list.invalidate();
      utils.sessions.listWithPermissions.invalidate();
      utils.results.sessionFinal.invalidate();
      utils.results.problemFinal.invalidate();
      utils.results.studentConsolidated.invalidate();
      setHasDraft(false);
      toast.success(existingEval ? "Avaliação atualizada com sucesso!" : "Avaliação do tutorial finalizada com sucesso! Sessão encerrada.");
    },
    onError: (e) => toast.error(e.message),
  });

  // Manual draft save
  const handleSaveDraft = () => {
    if (!selectedSessionId) { toast.error("Selecione uma sessão"); return; }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setDraftSaving(true);
    saveDraftMutation.mutate({
      sessionId: sessionIdNum,
      ...scores,
    }, {
      onSuccess: () => {
        toast.success("Rascunho salvo com sucesso!");
      },
    });
    // Also save student notes
    const notesArray = Object.values(studentNotes).filter(
      n => n.positivePoints > 0 || n.negativePoints > 0 || n.notes.trim().length > 0 || (n.positiveTexts && n.positiveTexts.some(t => t.trim().length > 0)) || (n.negativeTexts && n.negativeTexts.some(t => t.trim().length > 0))
    );
    if (notesArray.length > 0) {
      saveStudentNotesMutation.mutate({
        sessionId: sessionIdNum,
        notes: notesArray.map(n => ({
          studentId: n.studentId,
          positivePoints: n.positivePoints,
          negativePoints: n.negativePoints,
          positiveTexts: n.positiveTexts ?? [],
          negativeTexts: n.negativeTexts ?? [],
          notes: n.notes || null,
        })),
      });
    }
  };

  const totalGrade = useMemo(() => {
    return CRITERIA.reduce((sum, c) => sum + scores[c.key] * c.weight, 0);
  }, [scores]);

  const handleSubmit = () => {
    if (!selectedSessionId) { toast.error("Selecione uma sessão"); return; }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    // Save student notes before submitting
    const notesArray = Object.values(studentNotes).filter(
      n => n.positivePoints > 0 || n.negativePoints > 0 || n.notes.trim().length > 0 || (n.positiveTexts && n.positiveTexts.some(t => t.trim().length > 0)) || (n.negativeTexts && n.negativeTexts.some(t => t.trim().length > 0))
    );
    if (notesArray.length > 0) {
      saveStudentNotesMutation.mutate({
        sessionId: sessionIdNum,
        notes: notesArray.map(n => ({
          studentId: n.studentId,
          positivePoints: n.positivePoints,
          negativePoints: n.negativePoints,
          positiveTexts: n.positiveTexts ?? [],
          negativeTexts: n.negativeTexts ?? [],
          notes: n.notes || null,
        })),
      });
    }
    submitMutation.mutate({
      sessionId: sessionIdNum,
      ...scores,
    });
  };

  const isDataLoading = evalLoading || (canEvaluateSelected && draftLoading);
  const sessionStatus = (selectedSession as any)?.status as string | undefined;

  if (!selectedComponentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione um Componente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione um componente no menu lateral para avaliar sessões tutoriais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Avaliação do Tutorial</h1>
        {selectedComponentFullLabel && (
          <p className="text-sm font-semibold text-primary mt-0.5">{selectedComponentFullLabel}</p>
        )}
        <p className="text-muted-foreground mt-1 text-sm">
          Avalie a qualidade geral de cada sessão tutorial e faça anotações individuais sobre cada aluno.
        </p>
      </div>

      {/* Permission legend */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Legenda:</span>
            <div className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-blue-600" />
              <span>Sua turma</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-purple-600" />
              <span>Coordenador</span>
            </div>
            <div className="flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-emerald-600" />
              <span>Autorizado</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-red-500" />
              <span>Sem permissão</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros de semestre e turma */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Turma:</Label>
              <Select
                value={selectedClassId ? String(selectedClassId) : ""}
                onValueChange={(v) => setSelectedClassId(parseInt(v))}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  {(classesList ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.classCode}{c.professorUserId === user?.id ? " (minha)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 max-w-sm">
              <Label>Selecione a sessão</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha uma sessão..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSessions ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    effectiveSessions?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span className="flex items-center gap-2">
                          {s.label}
                          {s.evalPermission === "owner" && <Crown className="h-3 w-3 text-blue-600" />}
                          {s.evalPermission === "coordinator" && <ShieldCheck className="h-3 w-3 text-purple-600" />}
                          {s.evalPermission === "authorized" && <UserCheck className="h-3 w-3 text-emerald-600" />}
                          {s.evalPermission === "no_permission" && <ShieldAlert className="h-3 w-3 text-red-500" />}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              {selectedSession && <PermissionBadge permission={selectedSession.evalPermission} />}
              {selectedSession && <StatusBadge status={sessionStatus ?? ""} />}
              {existingEval && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Já avaliada (nota: {existingEval.tutorialGrade.toFixed(1)})
                </Badge>
              )}
              {!existingEval && hasDraft && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <FileEdit className="h-3.5 w-3.5 mr-1" />
                  Rascunho salvo
                </Badge>
              )}
              {selectedSession && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => window.open(`/brainstorm/${selectedSessionId}`, '_blank')}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Quadro de Brainstorming
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Informational messages based on session status */}
          {selectedSession && canEvaluateSelected && sessionStatus === "open" && !existingEval && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Esta sessão está <strong>Em Avaliação</strong> pelos alunos. Você pode começar a avaliar e salvar como rascunho. Ao <strong>finalizar</strong>, a sessão será encerrada automaticamente.
              </p>
            </div>
          )}

          {selectedSession && canEvaluateSelected && sessionStatus === "initiated" && !existingEval && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Esta sessão está no estado <strong>Ativa</strong>. Você pode começar a avaliar e salvar como rascunho. Ao <strong>finalizar</strong>, a sessão será encerrada automaticamente.
              </p>
            </div>
          )}

          {/* No permission warning */}
          {selectedSession && selectedSession.evalPermission === "no_permission" && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Você não tem permissão para avaliar sessões desta turma. Solicite ao professor responsável pela turma ou ao coordenador do componente para conceder acesso na seção de <strong>Permissões de Avaliação</strong>.
              </p>
            </div>
          )}


        </CardContent>
      </Card>

      {/* Evaluation form - show for any session status when user has permission */}
      {selectedSessionId && canEvaluateSelected && (
        isDataLoading ? (
          <Card><CardContent className="pt-6"><div className="space-y-6">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div></CardContent></Card>
        ) : (
          <>
            {/* Tutorial criteria card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Critérios de Avaliação do Tutorial
                </CardTitle>
                <CardDescription>
                  Avalie cada critério selecionando o nível correspondente. A nota final é calculada pela soma ponderada dos critérios (peso total = 10).
                  {!existingEval && (
                    <span className="block mt-1 text-xs text-muted-foreground/80">
                      O rascunho é salvo automaticamente a cada alteração. Use &quot;Finalizar Avaliação&quot; para encerrar a sessão.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {CRITERIA.map((criterion, idx) => (
                  <div key={criterion.key}>
                    {idx > 0 && <Separator className="mb-6" />}
                    <CriterionSelector
                      label={criterion.label}
                      weight={criterion.weight}
                      gender={criterion.gender}
                      description={criterion.description}
                      value={scores[criterion.key]}
                      onChange={(v) => handleScoreChange(criterion.key, v)}
                    />
                  </div>
                ))}

                <Separator />

                {/* Summary */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/30 border">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nota do Tutorial</p>
                    <p className="text-3xl font-bold mt-1">
                      <span className={totalGrade >= 7 ? "text-emerald-600" : totalGrade >= 5 ? "text-amber-600" : "text-red-600"}>
                        {totalGrade.toFixed(1)}
                      </span>
                      <span className="text-base font-normal text-muted-foreground"> / 10</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-student notes card */}
            {sessionStudents && sessionStudents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Anotações por Aluno
                  </CardTitle>
                  <CardDescription>
                    Registre pontos positivos e negativos de cada aluno durante o tutorial.
                    As anotações são salvas automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sessionStudents.map((student: any) => {
                      const note = studentNotes[student.studentId] ?? { studentId: student.studentId, positivePoints: 0, negativePoints: 0, positiveTexts: [""], negativeTexts: [""], notes: "" };
                      return (
                        <div key={student.studentId} className="p-4 rounded-lg border bg-card">
                          {/* Student header with photo and name side by side */}
                          <div className="flex items-center gap-3 mb-3">
                            {student.studentPhotoUrl ? (
                              <img
                                src={student.studentPhotoUrl}
                                alt={student.studentName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-muted"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground border-2 border-muted">
                                {student.studentName?.charAt(0)?.toUpperCase() ?? "?"}
                              </div>
                            )}
                            <p className="font-medium text-sm">{student.studentName}</p>
                          </div>

                          {/* Positive and Negative text fields side by side */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Positive annotation */}
                            <div className="border rounded-lg p-3 bg-emerald-50/50">
                              <div className="flex items-center gap-1.5 mb-2">
                                <ThumbsUp className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-emerald-700">Pontos Positivos</span>
                              </div>
                              <Textarea
                                placeholder="Anote os pontos positivos deste aluno..."
                                value={note.positiveTexts[0] ?? ""}
                                onChange={(e) => {
                                  handleStudentNoteChange(student.studentId, "positiveTexts", [e.target.value] as any);
                                }}
                                className="text-sm min-h-[80px] resize-y bg-white"
                                rows={3}
                              />
                            </div>

                            {/* Negative annotation */}
                            <div className="border rounded-lg p-3 bg-red-50/50">
                              <div className="flex items-center gap-1.5 mb-2">
                                <ThumbsDown className="h-4 w-4 text-red-600" />
                                <span className="text-sm font-semibold text-red-700">Pontos Negativos</span>
                              </div>
                              <Textarea
                                placeholder="Anote os pontos negativos deste aluno..."
                                value={note.negativeTexts[0] ?? ""}
                                onChange={(e) => {
                                  handleStudentNoteChange(student.studentId, "negativeTexts", [e.target.value] as any);
                                }}
                                className="text-sm min-h-[80px] resize-y bg-white"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions card */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-accent/30 border">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nota Final do Tutorial</p>
                      <p className="text-3xl font-bold mt-1">
                        <span className={totalGrade >= 7 ? "text-emerald-600" : totalGrade >= 5 ? "text-amber-600" : "text-red-600"}>
                          {totalGrade.toFixed(1)}
                        </span>
                        <span className="text-base font-normal text-muted-foreground"> / 10</span>
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                      {!existingEval && (
                        <Button
                          variant="outline"
                          onClick={handleSaveDraft}
                          disabled={draftSaving || saveDraftMutation.isPending}
                        >
                          <FileEdit className="h-4 w-4 mr-2" />
                          {draftSaving || saveDraftMutation.isPending ? "Salvando..." : "Salvar Rascunho"}
                        </Button>
                      )}
                      <Button size="lg" onClick={handleSubmit} disabled={submitMutation.isPending}>
                        {existingEval ? (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            {submitMutation.isPending ? "Salvando..." : "Atualizar Avaliação"}
                          </>
                        ) : (
                          <>
                            <SendHorizonal className="h-4 w-4 mr-2" />
                            {submitMutation.isPending ? "Finalizando..." : "Finalizar Avaliação"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Auto-save indicator */}
                  {!existingEval && lastAutoSaved && (
                    <p className="text-xs text-muted-foreground text-right">
                      Rascunho salvo automaticamente às {lastAutoSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}

                  {/* Warning: finalizing will close the session */}
                  {!existingEval && (sessionStatus === "open" || sessionStatus === "initiated" || sessionStatus === "closed") && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <p>
                        Ao clicar em <strong>Finalizar Avaliação</strong>, a sessão será <strong>encerrada</strong> automaticamente e os resultados finais serão calculados.
                        {sessionStatus === "open" && " Os alunos que ainda não avaliaram não poderão mais fazê-lo."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )
      )}

      {/* View-only existing eval for admin or no_permission */}
      {selectedSessionId && !canEvaluateSelected && existingEval && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Avaliação Existente (somente leitura)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {CRITERIA.map(c => {
                const val = Number((existingEval as any)[c.key]);
                const gradeTextColor = val <= 0 ? "text-red-600" : val <= 0.25 ? "text-orange-600" : val <= 0.5 ? "text-amber-600" : val <= 0.75 ? "text-lime-600" : "text-emerald-600";
                return (
                  <div key={c.key} className="p-3 rounded-lg bg-accent/20 border">
                    <p className="text-xs text-muted-foreground font-medium">{c.label} (peso {c.weight})</p>
                    <p className="text-lg font-bold mt-1">
                      <span className={gradeTextColor}>{getLabelForValue(val, c.gender)}</span>
                      <span className="text-sm font-normal text-muted-foreground ml-1">({val.toFixed(2)})</span>
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-4 rounded-lg bg-accent/30 border">
              <p className="text-sm font-medium text-muted-foreground">Nota do Tutorial</p>
              <p className="text-3xl font-bold mt-1">
                <span className={existingEval.tutorialGrade >= 7 ? "text-emerald-600" : existingEval.tutorialGrade >= 5 ? "text-amber-600" : "text-red-600"}>
                  {existingEval.tutorialGrade.toFixed(1)}
                </span>
                <span className="text-base font-normal text-muted-foreground"> / 10</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CriterionSelector({ label, weight, gender, description, value, onChange }: {
  label: string;
  weight: number;
  gender: "fem" | "masc";
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const labels = gender === "masc" ? LABELS_MASC : LABELS;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-base font-semibold">{label}</Label>
        <Badge variant="secondary" className="text-xs">Peso {weight}</Badge>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{description}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2 flex-wrap">
        {labels.map((opt) => {
          const gradeColor = opt.value <= 0 ? "border-red-400 hover:bg-red-50" 
            : opt.value <= 0.25 ? "border-orange-400 hover:bg-orange-50" 
            : opt.value <= 0.5 ? "border-amber-400 hover:bg-amber-50" 
            : opt.value <= 0.75 ? "border-lime-400 hover:bg-lime-50" 
            : "border-emerald-400 hover:bg-emerald-50";
          const selectedColor = opt.value <= 0 ? "bg-red-500 text-white border-red-500" 
            : opt.value <= 0.25 ? "bg-orange-500 text-white border-orange-500" 
            : opt.value <= 0.5 ? "bg-amber-500 text-white border-amber-500" 
            : opt.value <= 0.75 ? "bg-lime-600 text-white border-lime-600" 
            : "bg-emerald-600 text-white border-emerald-600";
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                Math.abs(value - opt.value) < 0.01
                  ? `${selectedColor} shadow-sm`
                  : `bg-background text-foreground ${gradeColor}`
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
