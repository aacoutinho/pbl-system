import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BookOpen, ClipboardCheck, Save, CheckCircle2, Info, ShieldCheck, ShieldAlert, Crown, UserCheck } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

// Rótulos descritivos com valores numéricos correspondentes
const LABELS = [
  { label: "Vixe, nada", value: 0 },
  { label: "Paia", value: 0.25 },
  { label: "Na estica", value: 0.5 },
  { label: "Massa", value: 0.75 },
  { label: "Brocou", value: 1.0 },
] as const;

// Variantes femininas para critérios que usam "Fraco" em vez de "Fraca"
const LABELS_MASC = [
  { label: "Vixe, nada", value: 0 },
  { label: "Paia", value: 0.25 },
  { label: "Na estica", value: 0.5 },
  { label: "Massa", value: 0.75 },
  { label: "Brocou", value: 1.0 },
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
    label: "Conteúdo",
    weight: 3,
    gender: "masc" as const,
    description: "As ideias, fatos e questões abordadas na sessão estavam coerentes, bem apresentadas e adequadas aos objetivos do problema.",
  },
  {
    key: "objetivo" as const,
    label: "Objetivo",
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

type EvalPermission = "owner" | "coordinator" | "authorized" | "no_permission" | "admin";

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

export default function TutorialEvalPage() {
  return (
    <DashboardLayout>
      <TutorialEvalContent />
    </DashboardLayout>
  );
}

function TutorialEvalContent() {
  const { selectedClassId } = useClassContext();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: sessionsWithPerms, isLoading: sessionsLoading } = trpc.sessions.listWithPermissions.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId && user?.role !== "admin" }
  );

  // Fallback for admin (who can't evaluate but can view)
  const { data: sessionsList, isLoading: sessionsListLoading } = trpc.sessions.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId && user?.role === "admin" }
  );

  const effectiveSessions = user?.role === "admin"
    ? sessionsList?.map(s => ({ ...s, evalPermission: "admin" as EvalPermission }))
    : sessionsWithPerms;
  const isLoadingSessions = user?.role === "admin" ? sessionsListLoading : sessionsLoading;

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  const selectedSession = useMemo(() => {
    if (!selectedSessionId || !effectiveSessions) return null;
    return effectiveSessions.find(s => String(s.id) === selectedSessionId) ?? null;
  }, [selectedSessionId, effectiveSessions]);

  const canEvaluateSelected = selectedSession
    ? selectedSession.evalPermission !== "no_permission" && selectedSession.evalPermission !== "admin"
    : false;

  const { data: existingEval, isLoading: evalLoading } = trpc.tutorialEval.get.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  const [scores, setScores] = useState<Record<CriteriaKey, number>>({
    organizacao: 0.5,
    cooperacao: 0.5,
    conteudo: 0.5,
    objetivo: 0.5,
    metas: 0.5,
  });

  // Load existing evaluation when selected
  useEffect(() => {
    if (existingEval) {
      setScores({
        organizacao: Number(existingEval.organizacao),
        cooperacao: Number(existingEval.cooperacao),
        conteudo: Number(existingEval.conteudo),
        objetivo: Number(existingEval.objetivo),
        metas: Number(existingEval.metas),
      });
    } else {
      setScores({ organizacao: 0.5, cooperacao: 0.5, conteudo: 0.5, objetivo: 0.5, metas: 0.5 });
    }
  }, [existingEval, selectedSessionId]);

  const submitMutation = trpc.tutorialEval.submit.useMutation({
    onSuccess: () => {
      utils.tutorialEval.get.invalidate();
      utils.results.sessionFinal.invalidate();
      utils.results.problemFinal.invalidate();
      toast.success(existingEval ? "Avaliação atualizada com sucesso!" : "Avaliação do tutorial salva com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const totalGrade = useMemo(() => {
    return CRITERIA.reduce((sum, c) => sum + scores[c.key] * c.weight, 0);
  }, [scores]);

  const handleSubmit = () => {
    if (!selectedSessionId) { toast.error("Selecione uma sessão"); return; }
    submitMutation.mutate({
      sessionId: parseInt(selectedSessionId),
      ...scores,
    });
  };

  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione uma Turma</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione uma turma no menu lateral para avaliar sessões tutoriais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Avaliação do Tutorial</h1>
        <p className="text-muted-foreground mt-1">
          Avalie a qualidade geral de cada sessão tutorial. A nota do tutorial será usada para calcular a nota final de desempenho dos alunos.
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
            <div className="flex items-center gap-2 mb-0.5">
              {selectedSession && <PermissionBadge permission={selectedSession.evalPermission} />}
              {existingEval && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Já avaliada (nota: {existingEval.tutorialGrade.toFixed(1)})
                </Badge>
              )}
            </div>
          </div>

          {/* No permission warning */}
          {selectedSession && selectedSession.evalPermission === "no_permission" && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Você não tem permissão para avaliar sessões desta turma. Solicite ao professor responsável pela turma ou ao coordenador do componente para conceder acesso na seção de <strong>Permissões de Avaliação</strong>.
              </p>
            </div>
          )}

          {selectedSession && selectedSession.evalPermission === "admin" && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Administradores podem visualizar as avaliações, mas não podem avaliar sessões tutoriais diretamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluation form */}
      {selectedSessionId && canEvaluateSelected && (
        evalLoading ? (
          <Card><CardContent className="pt-6"><div className="space-y-6">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div></CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Critérios de Avaliação
              </CardTitle>
              <CardDescription>
                Avalie cada critério selecionando o nível correspondente. A nota final é calculada pela soma ponderada dos critérios (peso total = 10).
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
                    onChange={(v) => setScores(prev => ({ ...prev, [criterion.key]: v }))}
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
                <Button size="lg" onClick={handleSubmit} disabled={submitMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {submitMutation.isPending ? "Salvando..." : existingEval ? "Atualizar Avaliação" : "Salvar Avaliação"}
                </Button>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Escala de avaliação:</p>
                  <p className="mt-1">
                    Vixe, nada = 0 &middot; Paia = 0.25 &middot; Na estica = 0.5 &middot; Massa = 0.75 &middot; Brocou = 1.0
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
              {CRITERIA.map(c => (
                <div key={c.key} className="p-3 rounded-lg bg-accent/20 border">
                  <p className="text-xs text-muted-foreground font-medium">{c.label} (peso {c.weight})</p>
                  <p className="text-lg font-bold mt-1">
                    {getLabelForValue(Number((existingEval as any)[c.key]), c.gender)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">({Number((existingEval as any)[c.key]).toFixed(2)})</span>
                  </p>
                </div>
              ))}
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
        {labels.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
              "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              Math.abs(value - opt.value) < 0.01
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
