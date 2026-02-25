import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, CheckCircle2, HelpCircle, Users, ClipboardList, Loader2, ShieldAlert, LinkIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo } from "react";

type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

interface StudentEval {
  evaluatedStudentId: number;
  pontualidade: number;
  pesquisaMetas: number;
  dominio: number;
  participacao: number;
  desempenhoPapel: number;
}

const roleLabels: Record<RoleType, string> = {
  COORDENADOR: "Coordenador",
  MESA: "Mesa",
  QUADRO: "Quadro",
  PARTICIPANTE: "Participante",
};

const gradeLabels: Record<string, Record<number, string>> = {
  fem: { 0: "Nenhuma", 0.25: "Fraca", 0.5: "Razoável", 0.75: "Boa", 1: "Excelente" },
  masc: { 0: "Nenhum", 0.25: "Fraco", 0.5: "Razoável", 0.75: "Bom", 1: "Excelente" },
};

const penaltyLabels: Record<number, string> = {
  0: "Nenhum",
  0.25: "Fraco",
  0.5: "Razoável",
  0.75: "Bom",
  1: "Excelente",
};

const gradeOptions = [0, 0.25, 0.5, 0.75, 1];

export default function DirectEvalPage() {
  // Get token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const { data, isLoading, error } = trpc.studentAccess.accessByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const [step, setStep] = useState<"form" | "done">("form");

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">
              Este link não contém um token de acesso válido. Verifique o link recebido por e-mail.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">Carregando...</h2>
            <p className="text-sm text-muted-foreground">Verificando seu link de acesso</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro de Acesso</h2>
            <p className="text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (data.alreadySubmitted && step === "form") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Avaliação Já Enviada</h2>
            <p className="text-muted-foreground mb-4">
              Você já realizou a avaliação da sessão <strong>{data.sessionLabel}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Se precisar reavaliar, solicite ao professor a liberação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Avaliação Enviada!</h2>
            <p className="text-muted-foreground mb-4">
              Sua avaliação da sessão <strong>{data.sessionLabel}</strong> foi registrada com sucesso.
            </p>
            <p className="text-sm text-muted-foreground">
              Obrigado pela participação! Você pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <EvaluationForm
        studentInfo={{
          studentId: data.studentId,
          studentName: data.studentName,
          sessionId: data.sessionId,
          sessionLabel: data.sessionLabel,
          classId: data.classId,
        }}
        sessionInfo={{
          sessionId: data.sessionId,
          label: data.sessionLabel,
          classCode: data.classCode,
          componentCode: data.componentCode,
          componentName: data.componentName,
          semester: "",
        }}
        onDone={() => setStep("done")}
      />
    </div>
  );
}

// ─── Evaluation Form Component (simplified for direct access) ───
function EvaluationForm({ studentInfo, sessionInfo, onDone }: {
  studentInfo: { studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number };
  sessionInfo: { sessionId: number; label: string; classCode: string; componentCode: string; componentName: string; semester: string };
  onDone: () => void;
}) {
  const { data: sessionStudentsList } = trpc.studentAccess.getSessionStudents.useQuery(
    { sessionId: studentInfo.sessionId },
    { enabled: !!studentInfo.sessionId }
  );

  const submitMutation = trpc.studentAccess.submitEvaluation.useMutation({
    onSuccess: () => {
      toast.success("Avaliação enviada com sucesso!");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const peersToEvaluate = useMemo(() => {
    if (!sessionStudentsList) return [];
    return sessionStudentsList.filter(s => s.studentId !== studentInfo.studentId);
  }, [sessionStudentsList, studentInfo.studentId]);

  // Only evaluate non-absent peers (professor already marked absent ones)
  const activePeers = useMemo(() => {
    return peersToEvaluate.filter(p => !p.absent);
  }, [peersToEvaluate]);

  const [evaluations, setEvaluations] = useState<Record<number, StudentEval>>({});

  useMemo(() => {
    if (activePeers.length > 0 && Object.keys(evaluations).length === 0) {
      const init: Record<number, StudentEval> = {};
      activePeers.forEach(p => {
        init[p.studentId] = {
          evaluatedStudentId: p.studentId,
          pontualidade: 1, pesquisaMetas: 1, dominio: 1, participacao: 1, desempenhoPapel: 0,
        };
      });
      setEvaluations(init);
    }
  }, [activePeers]);

  const updateEval = (studentId: number, field: keyof StudentEval, value: unknown) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSubmit = () => {
    const items = Object.values(evaluations);
    submitMutation.mutate({
      sessionId: studentInfo.sessionId,
      evaluatorStudentId: studentInfo.studentId,
      items,
    });
  };

  const totalPeers = activePeers.length;
  const absentPeers = peersToEvaluate.filter(p => p.absent).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <ClipboardList className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-blue-900">Avaliação de Pares</h1>
              <p className="text-sm text-blue-700 mt-1">
                {sessionInfo.componentCode} - {sessionInfo.classCode} &middot; {sessionInfo.label}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-white/80 text-blue-700 border-blue-200">
                  <Users className="h-3 w-3 mr-1" />
                  {totalPeers} colega{totalPeers !== 1 ? "s" : ""} {absentPeers > 0 && `(${absentPeers} ausente${absentPeers !== 1 ? "s" : ""})`}
                </Badge>
                <Badge variant="outline" className="bg-white/80 text-blue-700 border-blue-200">
                  Avaliador: {studentInfo.studentName}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Guide */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Instruções de Avaliação</p>
              <p><strong>Importante:</strong> O preenchimento deste formulário é um requisito obrigatório para obtenção da nota de desempenho da sessão tutorial do componente. Avalie de forma objetiva e imparcial, baseando-se apenas nas contribuições e discussões ocorridas durante a sessão tutorial.</p>
              <p className="mt-1">O papel de cada aluno já foi definido pelo professor. O critério "Desempenho no Papel" aparece apenas para Coordenador, Mesa e Quadro. Clique no ícone <strong>?</strong> ao lado de cada critério para ver a descrição detalhada de cada conceito.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peer evaluations */}
      {activePeers.map((peer) => {
        const ev = evaluations[peer.studentId];
        if (!ev) return null;
        const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(peer.role);
        const totalScore = ev.pontualidade * 1 + ev.pesquisaMetas * 3 + ev.dominio * 3 + ev.participacao * 3 - (hasRolePenalty ? ev.desempenhoPapel * 1 : 0);

        const criteriaItems = [
          { key: "pontualidade" as const, label: "Pontualidade", gender: "fem" as const, desc: "Excelente: Estava presente desde o início do tutorial, cumprindo integralmente o horário. | Boa: Chegou com até 10 minutos de atraso. | Razoável: Chegou com atraso considerável, mas antes da primeira hora. | Fraca: Chegou até 1h10 depois do início. | Nenhuma: Chegou após 1h10 do início.", sublabel: "Peso 1" },
          { key: "pesquisaMetas" as const, label: "Pesquisa/Metas", gender: "fem" as const, desc: "Excelente: Cumpriu todas as metas e/ou realizou tarefas extras. | Boa: Realizou a pesquisa e cumpriu a maior parte das metas. | Razoável: Cumpriu parcialmente ou pesquisou de forma superficial. | Fraca: Resultados insuficientes ou pesquisas irrelevantes. | Nenhuma: Não realizou pesquisas nem cumpriu metas.", sublabel: "Peso 3" },
          { key: "dominio" as const, label: "Domínio", gender: "masc" as const, desc: "Excelente: Trouxe novos conceitos e/ou corrigiu equívocos com clareza. | Bom: Compreendeu a maioria dos pontos e aplicou conceitos com segurança. | Razoável: Conhecimento básico, dificuldade para explicar ideias. | Fraco: Citou termos, mas não soube explicá-los. | Nenhum: Apenas ouvinte, sem demonstrar conhecimento.", sublabel: "Peso 3" },
          { key: "participacao" as const, label: "Participação", gender: "masc" as const, desc: "Excelente: Participou ativamente, estimulou o debate e aprofundou a discussão. | Bom: Contribuiu frequentemente, ouviu colegas e fez perguntas pertinentes. | Razoável: Participou pontualmente ou só quando solicitado. | Fraco: Contribuiu minimamente, dispersou atenção. | Nenhum: Silêncio absoluto ou total desinteresse.", sublabel: "Peso 3" },
        ];

        return (
          <Card key={peer.studentId} className="transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {peer.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base">{peer.studentName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <CardDescription className="text-xs">{peer.studentEnrollment}</CardDescription>
                      <Badge variant={peer.role === "PARTICIPANTE" ? "secondary" : "default"} className="text-xs">
                        {roleLabels[peer.role as RoleType]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${totalScore >= 8 ? "border-emerald-300 text-emerald-700" : totalScore >= 5 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                  {totalScore.toFixed(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <Separator />
              {criteriaItems.map(({ key, label, desc, sublabel, gender }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{label}</Label>
                      <span className="text-[10px] text-muted-foreground">({sublabel})</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm text-xs">
                            <div className="space-y-1">
                              {desc.includes("|") ? desc.split(" | ").map((line: string, i: number) => {
                                const [concept, ...rest] = line.split(": ");
                                return rest.length > 0 ? (
                                  <p key={i}><strong>{concept}:</strong> {rest.join(": ")}</p>
                                ) : (
                                  <p key={i}>{line}</p>
                                );
                              }) : <p>{desc}</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium">
                      {gradeLabels[gender][ev[key]] ?? ev[key]}
                    </Badge>
                  </div>
                  <Slider
                    value={[gradeOptions.indexOf(ev[key])]}
                    min={0}
                    max={4}
                    step={1}
                    onValueChange={([idx]) => updateEval(peer.studentId, key, gradeOptions[idx])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                    {gradeOptions.map(g => <span key={g}>{gradeLabels[gender][g]}</span>)}
                  </div>
                </div>
              ))}

              {hasRolePenalty && (
                <div className="space-y-2 pt-2 border-t border-dashed">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Desempenho no Papel de {roleLabels[peer.role as RoleType]}</Label>
                      <span className="text-[10px] text-muted-foreground">(Penalidade até -1)</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm text-xs">
                            <div className="space-y-1">
                              <p><em>Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial.</em></p>
                              <p><strong>Excelente:</strong> Cumpriu todas as funções da forma esperada.</p>
                              <p><strong>Bom:</strong> Executou a maior parte das funções, mas falhou em pontos isolados.</p>
                              <p><strong>Razoável:</strong> Tentou executar a função, mas deixou de realizar metade das tarefas.</p>
                              <p><strong>Fraco:</strong> Realizou apenas tarefas mínimas ou superficiais.</p>
                              <p><strong>Nenhum:</strong> Não cumpriu as funções essenciais de sua responsabilidade.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Badge variant="outline" className={`text-xs font-medium ${ev.desempenhoPapel > 0 ? "border-red-300 text-red-700" : ""}`}>
                      {penaltyLabels[ev.desempenhoPapel] ?? `-${ev.desempenhoPapel}`}
                    </Badge>
                  </div>
                  <Slider
                    value={[gradeOptions.indexOf(ev.desempenhoPapel)]}
                    min={0}
                    max={4}
                    step={1}
                    onValueChange={([idx]) => updateEval(peer.studentId, "desempenhoPapel", gradeOptions[idx])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                    {gradeOptions.map(g => <span key={g}>{penaltyLabels[g]}</span>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit */}
      {totalPeers > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-900">Pronto para enviar?</p>
                <p className="text-sm text-emerald-700">
                  {totalPeers} avaliação(ões)
                </p>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning */}
      <div className="text-center pb-6">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <LinkIcon className="h-3 w-3" />
          Este link é pessoal e intransferível
        </p>
      </div>
    </div>
  );
}
