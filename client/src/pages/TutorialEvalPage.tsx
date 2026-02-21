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
import { BookOpen, ClipboardCheck, Save, CheckCircle2, Info } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Rótulos descritivos com valores numéricos correspondentes
const LABELS = [
  { label: "Nenhuma", value: 0 },
  { label: "Fraca", value: 0.25 },
  { label: "Normal", value: 0.5 },
  { label: "Boa", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

// Variantes femininas para critérios que usam "Fraco" em vez de "Fraca"
const LABELS_MASC = [
  { label: "Nenhum", value: 0 },
  { label: "Fraco", value: 0.25 },
  { label: "Normal", value: 0.5 },
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

export default function TutorialEvalPage() {
  return (
    <DashboardLayout>
      <TutorialEvalContent />
    </DashboardLayout>
  );
}

function TutorialEvalContent() {
  const { selectedClassId } = useClassContext();
  const utils = trpc.useUtils();

  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

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

      {/* Session selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-sm">
              <Label>Selecione a sessão</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha uma sessão..." />
                </SelectTrigger>
                <SelectContent>
                  {sessionsLoading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    sessionsList?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <span className="flex items-center gap-2">
                          {s.label}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {existingEval && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 mb-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Já avaliada (nota: {existingEval.tutorialGrade.toFixed(1)})
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluation form */}
      {selectedSessionId && (
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
                    Nenhuma/Nenhum = 0 &middot; Fraca/Fraco = 0.25 &middot; Normal = 0.5 &middot; Boa/Bom = 0.75 &middot; Excelente = 1.0
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
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
