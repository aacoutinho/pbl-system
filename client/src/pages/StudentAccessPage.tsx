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
import { KeyRound, LogIn, Send, UserX, CheckCircle2, AlertTriangle, ArrowLeft, BookOpen } from "lucide-react";
import { useState, useMemo } from "react";

type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

interface StudentEval {
  evaluatedStudentId: number;
  role: RoleType;
  absent: boolean;
  atuacao: number;
  pontualidade: number;
  dominio: number;
  metas: number;
  participacao: number;
}

type Step = "code" | "login" | "evaluate" | "done";

export default function StudentAccessPage() {
  const [step, setStep] = useState<Step>("code");
  const [accessCode, setAccessCode] = useState("");
  const [emailUsername, setEmailUsername] = useState("");
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: number; label: string; classCode: string; componentCode: string; semester: string;
  } | null>(null);
  const [studentInfo, setStudentInfo] = useState<{
    studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number;
  } | null>(null);

  // Step 1: Validate access code
  const validateCodeQuery = trpc.studentAccess.validateCode.useQuery(
    { accessCode: accessCode.toUpperCase() },
    { enabled: false, retry: false }
  );

  // Step 2: Login mutation
  const loginMutation = trpc.studentAccess.login.useMutation({
    onSuccess: (data) => {
      if (data.alreadySubmitted) {
        toast.info("Você já enviou sua avaliação para esta sessão.");
        setStep("done");
      } else {
        setStudentInfo(data);
        setStep("evaluate");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleValidateCode = async () => {
    if (!accessCode.trim()) { toast.error("Digite o código da sessão"); return; }
    try {
      const result = await validateCodeQuery.refetch();
      if (result.data) {
        setSessionInfo(result.data);
        setStep("login");
      }
    } catch (e: any) {
      toast.error(e?.message || "Código inválido");
    }
  };

  const handleLogin = () => {
    if (!emailUsername.trim()) { toast.error("Digite seu usuário"); return; }
    loginMutation.mutate({ accessCode: accessCode.toUpperCase(), emailUsername: emailUsername.trim() });
  };

  if (step === "code") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Acesso à Sessão Tutorial</CardTitle>
            <CardDescription>
              Digite o código fornecido pelo professor para acessar a avaliação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code">Código da Sessão</Label>
              <Input
                id="code"
                placeholder="Ex: ABC123"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleValidateCode()}
                className="mt-1 text-center text-2xl tracking-widest font-mono uppercase"
                maxLength={8}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleValidateCode}
              disabled={validateCodeQuery.isFetching}
            >
              {validateCodeQuery.isFetching ? "Verificando..." : "Acessar Sessão"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <LogIn className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Identificação</CardTitle>
            <CardDescription>
              Sessão: <strong>{sessionInfo?.label}</strong>
              <br />
              Turma: {sessionInfo?.componentCode} - {sessionInfo?.classCode} ({sessionInfo?.semester})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="username">Seu usuário (e-mail sem @domínio)</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input
                  id="username"
                  placeholder="Ex: aatrcoutinho"
                  value={emailUsername}
                  onChange={(e) => setEmailUsername(e.target.value.toLowerCase().trim())}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="font-mono"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">@ecomp.uefs.br</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use a parte do e-mail antes do @. Exemplo: para aatrcoutinho@ecomp.uefs.br, digite <strong>aatrcoutinho</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("code"); setAccessCode(""); setEmailUsername(""); }}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={handleLogin}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <CardTitle className="text-xl text-emerald-700">Avaliação Enviada!</CardTitle>
            <CardDescription>
              Sua avaliação foi registrada com sucesso. Obrigado pela participação!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => { setStep("code"); setAccessCode(""); setEmailUsername(""); setStudentInfo(null); setSessionInfo(null); }}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: evaluate
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <EvaluationForm
        accessCode={accessCode}
        studentInfo={studentInfo!}
        sessionInfo={sessionInfo!}
        onDone={() => setStep("done")}
        onBack={() => { setStep("login"); setStudentInfo(null); }}
      />
    </div>
  );
}

function EvaluationForm({ accessCode, studentInfo, sessionInfo, onDone, onBack }: {
  accessCode: string;
  studentInfo: { studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number };
  sessionInfo: { sessionId: number; label: string; classCode: string; componentCode: string; semester: string };
  onDone: () => void;
  onBack: () => void;
}) {
  const { data: sessionStudentsList } = trpc.studentAccess.getSessionStudents.useQuery({ accessCode });

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
          atuacao: 2, pontualidade: 2, dominio: 2, metas: 2, participacao: 2,
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
      accessCode: accessCode.toUpperCase(),
      evaluatorStudentId: studentInfo.studentId,
      items,
    });
  };

  const totalPeers = peersToEvaluate.length;
  const absentCount = Object.values(evaluations).filter(e => e.absent).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sessionInfo.label}</h1>
          <p className="text-muted-foreground">
            Olá, <strong>{studentInfo.studentName}</strong>. Avalie o desempenho dos seus colegas.
          </p>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-sm">
            <span>Avaliando <strong>{totalPeers - absentCount}</strong> colegas ({absentCount} falta{absentCount !== 1 ? "s" : ""})</span>
            <div className="flex gap-2">
              {Object.entries(assignedExclusiveRoles).map(([role]) => (
                <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {peersToEvaluate.map(peer => {
        const ev = evaluations[peer.studentId];
        if (!ev) return null;
        const totalScore = ev.absent ? 0 : ev.atuacao + ev.pontualidade + ev.dominio + ev.metas + ev.participacao;

        return (
          <Card key={peer.studentId} className={`transition-all ${ev.absent ? "opacity-60 bg-muted/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{peer.studentName}</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  {!ev.absent && (
                    <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${totalScore >= 8 ? "border-emerald-300 text-emerald-700" : totalScore >= 5 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                      {totalScore.toFixed(1)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`absent-${peer.studentId}`} className="text-sm text-muted-foreground">
                      <UserX className="h-4 w-4" />
                    </Label>
                    <Switch
                      id={`absent-${peer.studentId}`}
                      checked={ev.absent}
                      onCheckedChange={(checked) => updateEval(peer.studentId, "absent", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            {!ev.absent && (
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Papel na sessão</Label>
                  <Select value={ev.role} onValueChange={(v) => handleRoleChange(peer.studentId, v as RoleType)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTICIPANTE">Participante</SelectItem>
                      <SelectItem value="COORDENADOR" disabled={!!assignedExclusiveRoles["COORDENADOR"] && assignedExclusiveRoles["COORDENADOR"] !== peer.studentId}>
                        Coordenador {assignedExclusiveRoles["COORDENADOR"] && assignedExclusiveRoles["COORDENADOR"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                      <SelectItem value="MESA" disabled={!!assignedExclusiveRoles["MESA"] && assignedExclusiveRoles["MESA"] !== peer.studentId}>
                        Mesa {assignedExclusiveRoles["MESA"] && assignedExclusiveRoles["MESA"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                      <SelectItem value="QUADRO" disabled={!!assignedExclusiveRoles["QUADRO"] && assignedExclusiveRoles["QUADRO"] !== peer.studentId}>
                        Quadro {assignedExclusiveRoles["QUADRO"] && assignedExclusiveRoles["QUADRO"] !== peer.studentId ? "(já atribuído)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <CriteriaSlider label="Atuação" value={ev.atuacao} onChange={(v) => updateEval(peer.studentId, "atuacao", v)} />
                  <CriteriaSlider label="Pontualidade" value={ev.pontualidade} onChange={(v) => updateEval(peer.studentId, "pontualidade", v)} />
                  <CriteriaSlider label="Domínio" value={ev.dominio} onChange={(v) => updateEval(peer.studentId, "dominio", v)} />
                  <CriteriaSlider label="Metas" value={ev.metas} onChange={(v) => updateEval(peer.studentId, "metas", v)} />
                  <CriteriaSlider label="Participação" value={ev.participacao} onChange={(v) => updateEval(peer.studentId, "participacao", v)} />
                </div>
              </CardContent>
            )}

            {ev.absent && (
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Marcado como ausente. A nota será 0 e não será contabilizada na média.
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="flex justify-end pb-8">
        <Button size="lg" onClick={handleSubmit} disabled={submitMutation.isPending} className="shadow-md">
          {submitMutation.isPending ? (
            "Enviando..."
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Avaliação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CriteriaSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const color = value >= 1.5 ? "text-emerald-600" : value >= 1 ? "text-amber-600" : "text-red-600";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className={`text-sm font-bold tabular-nums ${color}`}>{value.toFixed(1)}</span>
      </div>
      <Slider
        min={0}
        max={2}
        step={0.5}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>0.5</span>
        <span>1.0</span>
        <span>1.5</span>
        <span>2.0</span>
      </div>
    </div>
  );
}
