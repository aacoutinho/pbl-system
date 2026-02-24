import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, UserX, CheckCircle2, AlertTriangle, ArrowLeft, BookOpen, HelpCircle, Users, ClipboardList, Loader2, ShieldAlert, LinkIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo, useEffect } from "react";

type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

interface StudentEval {
  evaluatedStudentId: number;
  role: RoleType;
  absent: boolean;
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

const gradeLabels: Record<number, string> = {
  0: "Nenhuma",
  0.25: "Fraco/Fraca",
  0.5: "Normal",
  0.75: "Boa",
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

  const [evaluations, setEvaluations] = useState<Record<number, StudentEval>>({});

  useMemo(() => {
    if (peersToEvaluate.length > 0 && Object.keys(evaluations).length === 0) {
      const init: Record<number, StudentEval> = {};
      peersToEvaluate.forEach(p => {
        init[p.studentId] = {
          evaluatedStudentId: p.studentId,
          role: "PARTICIPANTE",
          absent: false,
          pontualidade: 1, pesquisaMetas: 1, dominio: 1, participacao: 1, desempenhoPapel: 0,
        };
      });
      setEvaluations(init);
    }
  }, [peersToEvaluate]);

  const updateEval = (studentId: number, field: keyof StudentEval, value: unknown) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const assignedExclusiveRoles = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(evaluations).forEach(ev => {
      if (!ev.absent && ["COORDENADOR", "MESA", "QUADRO"].includes(ev.role)) {
        map[ev.role] = ev.evaluatedStudentId;
      }
    });
    return map;
  }, [evaluations]);

  const handleRoleChange = (studentId: number, newRole: RoleType) => {
    if (["COORDENADOR", "MESA", "QUADRO"].includes(newRole)) {
      const currentHolder = assignedExclusiveRoles[newRole];
      if (currentHolder && currentHolder !== studentId) {
        updateEval(currentHolder, "role", "PARTICIPANTE");
      }
    }
    updateEval(studentId, "role", newRole);
  };

  const handleSubmit = () => {
    const items = Object.values(evaluations);
    const exclusiveRoles = ["COORDENADOR", "MESA", "QUADRO"];
    for (const role of exclusiveRoles) {
      const holders = items.filter(i => i.role === role && !i.absent);
      if (holders.length > 1) { toast.error(`O papel ${role} só pode ser atribuído a um aluno`); return; }
    }
    submitMutation.mutate({
      sessionId: studentInfo.sessionId,
      evaluatorStudentId: studentInfo.studentId,
      items,
    });
  };

  const totalPeers = peersToEvaluate.length;
  const absentCount = Object.values(evaluations).filter(e => e.absent).length;

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
                  {totalPeers} colega(s)
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
              <p>Avalie cada colega nos critérios abaixo. Atribua o papel desempenhado na sessão e marque como ausente se necessário.</p>
              <p className="text-xs text-amber-700">Papéis exclusivos (Coordenador, Mesa, Quadro) só podem ser atribuídos a um aluno cada.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peer evaluations */}
      {peersToEvaluate.map((peer) => {
        const ev = evaluations[peer.studentId];
        if (!ev) return null;
        return (
          <Card key={peer.studentId} className={ev.absent ? "opacity-60 border-red-200" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {peer.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base">{peer.studentName}</CardTitle>
                    <CardDescription className="text-xs">{peer.studentEnrollment}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={ev.role} onValueChange={(v) => handleRoleChange(peer.studentId, v as RoleType)} disabled={ev.absent}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleLabels) as RoleType[]).map(r => {
                        const taken = assignedExclusiveRoles[r] && assignedExclusiveRoles[r] !== peer.studentId;
                        return (
                          <SelectItem key={r} value={r} disabled={!!taken}>
                            {roleLabels[r]} {taken ? "(atribuído)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={ev.absent}
                      onCheckedChange={(v) => updateEval(peer.studentId, "absent", v)}
                    />
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserX className="h-3.5 w-3.5" /> Ausente
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            {!ev.absent && (
              <CardContent className="pt-0 space-y-4">
                <Separator />
                {[
                  { key: "pontualidade" as const, label: "Pontualidade", desc: "Chegou no horário e permaneceu durante toda a sessão" },
                  { key: "pesquisaMetas" as const, label: "Pesquisa/Metas", desc: "Cumpriu as metas de pesquisa e preparação" },
                  { key: "dominio" as const, label: "Domínio", desc: "Demonstrou domínio do conteúdo discutido" },
                  { key: "participacao" as const, label: "Participação", desc: "Participou ativamente das discussões" },
                  { key: "desempenhoPapel" as const, label: "Desempenho do Papel", desc: "Desempenhou bem o papel atribuído na sessão" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">{label}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent><p className="text-xs max-w-xs">{desc}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Badge variant="outline" className="text-xs font-medium">
                        {gradeLabels[ev[key]] ?? ev[key]}
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
                      {gradeOptions.map(g => <span key={g}>{gradeLabels[g]}</span>)}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
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
                  {totalPeers - absentCount} avaliação(ões) &middot; {absentCount} ausente(s)
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
