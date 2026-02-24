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
import { LogIn, Send, UserX, CheckCircle2, AlertTriangle, ArrowLeft, BookOpen, HelpCircle, Camera, Mail, ShieldCheck, Upload, ClipboardList, Clock, GraduationCap, User, History, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo, useRef } from "react";
import { resizeImageToSquare, base64SizeKB } from "@/lib/resizeImage";

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

type Step = "login" | "dashboard" | "profile" | "evaluate" | "done";

interface StudentData {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentEnrollment: string;
  studentPhotoUrl: string | null;
  isFirstAccess: boolean;
  classes: { classId: number; classCode: string; componentCode: string; componentName: string; semester: string }[];
}

interface SelectedSession {
  sessionId: number;
  sessionLabel: string;
  classId: number;
  classCode: string;
  componentCode: string;
  componentName: string;
  semester: string;
  accessCode: string | null;
}

export default function StudentAccessPage() {
  const [step, setStep] = useState<Step>("login");
  const [enrollment, setEnrollment] = useState("");
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [submittedSessionId, setSubmittedSessionId] = useState<number | null>(null);

  // Login by enrollment
  const loginMutation = trpc.studentAccess.loginByEnrollment.useMutation({
    onSuccess: (data) => {
      setStudentData(data);
      setStudentEmail(data.studentEmail || "");
      setStudentPhotoUrl(data.studentPhotoUrl || null);
      // If first access and missing email or photo, go to profile setup
      const needsProfile = !data.studentEmail || !data.studentPhotoUrl;
      if (data.isFirstAccess && needsProfile) {
        setStep("profile");
      } else {
        setStep("dashboard");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Update email mutation
  const updateEmailMutation = trpc.studentAccess.updateEmail.useMutation({
    onSuccess: () => toast.success("E-mail atualizado"),
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogin = () => {
    if (!enrollment.trim()) { toast.error("Digite sua matrícula"); return; }
    loginMutation.mutate({ enrollment: enrollment.trim() });
  };

  const handleSelectSession = (session: SelectedSession) => {
    setSelectedSession(session);
    setStep("evaluate");
  };

  const handleEvalDone = () => {
    setSubmittedSessionId(selectedSession?.sessionId || null);
    setSelectedSession(null);
    setStep("done");
  };

  const handleBackToDashboard = () => {
    setSelectedSession(null);
    setSubmittedSessionId(null);
    setStep("dashboard");
  };

  // ─── Step: Login ───
  if (step === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Acesso do Aluno</CardTitle>
            <CardDescription>
              Digite sua matrícula para acessar as avaliações tutoriais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="enrollment">Matrícula</Label>
              <Input
                id="enrollment"
                placeholder="Ex: 20221001"
                value={enrollment}
                onChange={(e) => setEnrollment(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="mt-1 text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleLogin}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Verificando..." : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step: Profile setup (first access) ───
  if (step === "profile") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 flex items-center justify-center">
        <ProfileSetup
          studentId={studentData!.studentId}
          studentName={studentData!.studentName}
          currentEmail={studentEmail}
          currentPhotoUrl={studentPhotoUrl}
          isFirstEval={studentData!.isFirstAccess}
          onComplete={(email, photoUrl) => {
            if (email) setStudentEmail(email);
            if (photoUrl) setStudentPhotoUrl(photoUrl);
            setStep("dashboard");
          }}
          onBack={() => { setStep("login"); setStudentData(null); setEnrollment(""); }}
        />
      </div>
    );
  }

  // ─── Step: Dashboard (profile + open sessions) ───
  if (step === "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <StudentDashboard
          studentData={studentData!}
          studentEmail={studentEmail}
          studentPhotoUrl={studentPhotoUrl}
          onSelectSession={handleSelectSession}
          onEditProfile={() => setStep("profile")}
          onLogout={() => { setStep("login"); setStudentData(null); setEnrollment(""); setStudentEmail(""); setStudentPhotoUrl(null); }}
        />
      </div>
    );
  }

  // ─── Step: Done (after submitting) ───
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
            <Button variant="outline" className="w-full" onClick={handleBackToDashboard}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao Painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step: Evaluate ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <EvaluationForm
        accessCode={selectedSession!.accessCode || ""}
        studentInfo={{
          studentId: studentData!.studentId,
          studentName: studentData!.studentName,
          sessionId: selectedSession!.sessionId,
          sessionLabel: selectedSession!.sessionLabel,
          classId: selectedSession!.classId,
        }}
        sessionInfo={{
          sessionId: selectedSession!.sessionId,
          label: selectedSession!.sessionLabel,
          classCode: selectedSession!.classCode,
          componentCode: selectedSession!.componentCode,
          componentName: selectedSession!.componentName,
          semester: selectedSession!.semester,
        }}
        studentEmail={studentEmail}
        studentPhotoUrl={studentPhotoUrl}
        onEmailChange={setStudentEmail}
        onEmailSave={(email) => {
          if (studentData) updateEmailMutation.mutate({ studentId: studentData.studentId, email });
        }}
        onPhotoChange={setStudentPhotoUrl}
        onEditProfile={() => setStep("profile")}
        onDone={handleEvalDone}
        onBack={handleBackToDashboard}
      />
    </div>
  );
}

// ─── Student Dashboard Component ───
function StudentDashboard({ studentData, studentEmail, studentPhotoUrl, onSelectSession, onEditProfile, onLogout }: {
  studentData: StudentData;
  studentEmail: string;
  studentPhotoUrl: string | null;
  onSelectSession: (session: SelectedSession) => void;
  onEditProfile: () => void;
  onLogout: () => void;
}) {
  const { data: openSessions, isLoading } = trpc.studentAccess.myOpenSessions.useQuery(
    { studentId: studentData.studentId },
    { refetchInterval: 15000 }
  );
  const { data: evalHistory, isLoading: historyLoading } = trpc.studentAccess.myEvaluationHistory.useQuery(
    { studentId: studentData.studentId },
  );

  const pendingSessions = openSessions?.filter(s => !s.alreadySubmitted) || [];
  const completedSessions = openSessions?.filter(s => s.alreadySubmitted) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Painel do Aluno
        </h1>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
          Sair
        </Button>
      </div>

      {/* Profile Card */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            {studentPhotoUrl ? (
              <img src={studentPhotoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border-3 border-blue-200 shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-3 border-blue-200 shadow-md">
                <User className="h-7 w-7 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{studentData.studentName}</h2>
              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs font-mono">{studentData.studentEnrollment}</Badge>
                </span>
                <span className="flex items-center gap-1 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {studentEmail || "E-mail não informado"}
                </span>
              </div>
              {studentData.classes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {studentData.classes.map(c => (
                    <Badge key={c.classId} variant="outline" className="text-xs">
                      {c.componentCode} - {c.classCode}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onEditProfile} className="shrink-0">
              Editar Perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Open Sessions - Pending */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-600" />
          Sessões Abertas para Avaliação
        </h3>
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando sessões...
            </CardContent>
          </Card>
        ) : pendingSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">Nenhuma sessão aberta no momento</p>
              <p className="text-sm mt-1">Quando o professor abrir uma sessão tutorial, ela aparecerá aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingSessions.map(session => (
              <Card key={session.sessionId} className="hover:shadow-md transition-shadow cursor-pointer border-amber-200 bg-amber-50/30" onClick={() => onSelectSession({
                sessionId: session.sessionId,
                sessionLabel: session.sessionLabel,
                classId: session.classId,
                classCode: session.classCode,
                componentCode: session.componentCode,
                componentName: session.componentName,
                semester: session.semester,
                accessCode: session.accessCode,
              })}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{session.sessionLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.componentCode} - {session.classCode} ({session.semester})
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Problema {session.problemNumber} &middot; Sessão {session.sessionNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">Pendente</Badge>
                      <Button size="sm" className="shadow-sm">
                        Avaliar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Avaliações Já Realizadas (Sessões Abertas)
          </h3>
          <div className="space-y-2">
            {completedSessions.map(session => (
              <Card key={session.sessionId} className="opacity-70">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{session.sessionLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.componentCode} - {session.classCode} ({session.semester})
                      </p>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluída
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation History */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          Histórico de Avaliações
        </h3>
        {historyLoading ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Carregando histórico...
            </CardContent>
          </Card>
        ) : !evalHistory || evalHistory.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-sm">Nenhuma avaliação realizada ainda</p>
              <p className="text-xs mt-1">Seu histórico de avaliações aparecerá aqui após participar de sessões tutoriais.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {evalHistory.map((ev, idx) => (
              <Card key={`${ev.sessionId}-${idx}`} className="border-blue-100">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{ev.sessionLabel}</p>
                        <Badge variant={ev.sessionStatus === 'finished' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                          {ev.sessionStatus === 'finished' ? 'Encerrada' : ev.sessionStatus === 'closed' ? 'Fechada' : ev.sessionStatus === 'open' ? 'Aberta' : 'Iniciada'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.componentCode} - {ev.classCode} ({ev.semester})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Problema {ev.problemNumber} &middot; Sessão {ev.sessionNumber}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3" />
                        {ev.peersEvaluated}/{ev.totalPeers} pares
                      </div>
                      <div className="text-sm font-semibold text-blue-700">
                        Média: {ev.avgGradeGiven.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(ev.submittedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Evaluation Form Component ───
function EvaluationForm({ accessCode, studentInfo, sessionInfo, studentEmail, studentPhotoUrl, onEmailChange, onEmailSave, onPhotoChange, onEditProfile, onDone, onBack }: {
  accessCode: string;
  studentInfo: { studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number };
  sessionInfo: { sessionId: number; label: string; classCode: string; componentCode: string; componentName: string; semester: string };
  studentEmail: string;
  studentPhotoUrl: string | null;
  onEmailChange: (email: string) => void;
  onEmailSave: (email: string) => void;
  onPhotoChange: (url: string) => void;
  onEditProfile: () => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const { data: sessionStudentsList } = trpc.studentAccess.getSessionStudents.useQuery(
    { accessCode },
    { enabled: !!accessCode }
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

      {/* Profile info card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            {studentPhotoUrl ? (
              <img src={studentPhotoUrl} alt="Foto" className="w-12 h-12 rounded-full object-cover border-2 border-blue-200" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                <Camera className="h-5 w-5 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{studentEmail || "E-mail não informado"}</p>
              <p className="text-xs text-muted-foreground">
                {studentPhotoUrl && studentEmail ? "Perfil completo" : "Perfil incompleto"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              Editar Perfil
            </Button>
          </div>
        </CardContent>
      </Card>

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
        const totalScore = ev.absent ? 0 : ev.pontualidade * 1 + ev.pesquisaMetas * 3 + ev.dominio * 3 + ev.participacao * 3 - ev.desempenhoPapel * 1;

        return (
          <Card key={peer.studentId} className={`transition-all ${ev.absent ? "opacity-60 bg-muted/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {peer.studentPhotoUrl ? (
                    <img src={peer.studentPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-muted shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border-2 border-muted shrink-0">
                      <span className="text-sm font-medium text-muted-foreground">{peer.studentName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
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

                <TooltipProvider>
                <div className="space-y-4">
                  <CriteriaSlider label="Pontualidade" sublabel="Peso 1" tooltip="Avalia se o colega chegou no horário e permaneceu durante toda a sessão tutorial." value={ev.pontualidade} onChange={(v) => updateEval(peer.studentId, "pontualidade", v)} gender="fem" />
                  <CriteriaSlider label="Pesquisa / Metas" sublabel="Peso 3" tooltip="Avalia se o colega pesquisou previamente sobre o tema, trouxe materiais relevantes e cumpriu as metas estabelecidas na sessão anterior." value={ev.pesquisaMetas} onChange={(v) => updateEval(peer.studentId, "pesquisaMetas", v)} gender="fem" />
                  <CriteriaSlider label="Domínio do Assunto" sublabel="Peso 3" tooltip="Avalia o nível de conhecimento demonstrado pelo colega sobre o tema discutido na sessão tutorial." value={ev.dominio} onChange={(v) => updateEval(peer.studentId, "dominio", v)} gender="masc" />
                  <CriteriaSlider label="Participação" sublabel="Peso 3" tooltip="Avalia o envolvimento ativo do colega nas discussões, contribuindo com ideias, perguntas e argumentos durante a sessão." value={ev.participacao} onChange={(v) => updateEval(peer.studentId, "participacao", v)} gender="fem" />
                  <CriteriaSlider label="Desempenho no Papel" sublabel="Penalidade (até -1)" tooltip="Penalidade aplicada quando o colega não desempenhou adequadamente o papel atribuído (Coordenador, Mesa ou Quadro). Se desempenhou bem, deixe em 'Sem penalidade'." value={ev.desempenhoPapel} onChange={(v) => updateEval(peer.studentId, "desempenhoPapel", v)} penalty />
                </div>
                </TooltipProvider>
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

// ─── Profile Setup Component ───
function ProfileSetup({ studentId, studentName, currentEmail, currentPhotoUrl, isFirstEval, onComplete, onBack }: {
  studentId: number;
  studentName: string;
  currentEmail: string;
  currentPhotoUrl: string | null;
  isFirstEval: boolean;
  onComplete: (email: string | null, photoUrl: string | null) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(currentEmail || "");
  const [emailVerified, setEmailVerified] = useState(!!currentEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentPhotoUrl);
  const [photoFile, setPhotoFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(!!currentPhotoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendCodeMutation = trpc.studentAccess.sendEmailVerification.useMutation({
    onSuccess: () => { setCodeSent(true); toast.success("Código enviado para " + email); },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar código"),
  });

  const verifyCodeMutation = trpc.studentAccess.verifyEmailCode.useMutation({
    onSuccess: () => { setEmailVerified(true); toast.success("E-mail verificado!"); },
    onError: (e: any) => toast.error(e.message || "Código inválido"),
  });

  const uploadPhotoMutation = trpc.studentAccess.uploadPhoto.useMutation({
    onSuccess: (data) => { setPhotoUploaded(true); setPhotoPreview(data.photoUrl); toast.success("Foto salva!"); },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar foto"),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Foto deve ter no máximo 10MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    try {
      const resized = await resizeImageToSquare(file, 150, 0.7);
      const previewUrl = `data:${resized.mimeType};base64,${resized.base64}`;
      setPhotoPreview(previewUrl);
      setPhotoFile(resized);
      setPhotoUploaded(false);
      toast.success(`Foto redimensionada para 150x150px (~${base64SizeKB(resized.base64)}KB)`);
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const handleUploadPhoto = () => {
    if (!photoFile) return;
    uploadPhotoMutation.mutate({ studentId, photoBase64: photoFile.base64, mimeType: photoFile.mimeType });
  };

  const canProceed = isFirstEval ? (emailVerified && (photoUploaded || !!currentPhotoUrl)) : true;

  const handleComplete = () => {
    onComplete(
      emailVerified ? email : null,
      photoUploaded ? photoPreview : currentPhotoUrl
    );
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mb-3">
          <ShieldCheck className="h-7 w-7 text-purple-600" />
        </div>
        <CardTitle className="text-xl">{isFirstEval ? "Complete seu Perfil" : "Editar Perfil"}</CardTitle>
        <CardDescription>
          {isFirstEval
            ? "Antes de avaliar, precisamos do seu e-mail e uma foto. O e-mail é para receber suas notas, e a foto ajuda o professor nas avaliações."
            : "Atualize seu e-mail ou foto se desejar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* E-mail com verificação */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mail {isFirstEval && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
          </Label>
          <p className="text-xs text-muted-foreground">Informe seu e-mail para receber as notas das avaliações.</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="seu.email@ecomp.uefs.br"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailVerified(false); setCodeSent(false); setVerificationCode(""); }}
              disabled={emailVerified}
              className="flex-1"
            />
            {!emailVerified && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!email.trim() || !email.includes("@")) { toast.error("E-mail inválido"); return; }
                  sendCodeMutation.mutate({ studentId, email: email.trim().toLowerCase() });
                }}
                disabled={sendCodeMutation.isPending || !email.trim()}
              >
                {sendCodeMutation.isPending ? "Enviando..." : codeSent ? "Reenviar" : "Enviar Código"}
              </Button>
            )}
          </div>
          {emailVerified && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              E-mail verificado
              <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={() => { setEmailVerified(false); setCodeSent(false); setVerificationCode(""); }}>
                Alterar
              </Button>
            </div>
          )}
          {codeSent && !emailVerified && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos enviado para <strong>{email}</strong>:</p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="w-32 text-center text-lg tracking-widest font-mono"
                />
                <Button
                  onClick={() => verifyCodeMutation.mutate({ studentId, email: email.trim().toLowerCase(), code: verificationCode })}
                  disabled={verificationCode.length !== 6 || verifyCodeMutation.isPending}
                >
                  {verifyCodeMutation.isPending ? "Verificando..." : "Verificar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Foto */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Foto {isFirstEval && <Badge variant="destructive" className="text-xs">Obrigatório</Badge>}
          </Label>
          <p className="text-xs text-muted-foreground">Tire uma foto ou faça upload. A foto ajuda o professor a identificar os alunos nas avaliações.</p>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-purple-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <Camera className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                {photoPreview ? "Trocar Foto" : "Tirar / Enviar Foto"}
              </Button>
              {photoFile && !photoUploaded && (
                <Button size="sm" onClick={handleUploadPhoto} disabled={uploadPhotoMutation.isPending}>
                  {uploadPhotoMutation.isPending ? "Salvando..." : "Salvar Foto"}
                </Button>
              )}
              {photoUploaded && (
                <span className="flex items-center gap-1 text-emerald-600 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Foto salva
                </span>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button
            onClick={handleComplete}
            disabled={isFirstEval && !canProceed}
            className="flex-1"
          >
            {isFirstEval ? "Continuar" : "Salvar e Voltar"}
          </Button>
        </div>
        {isFirstEval && !canProceed && (
          <p className="text-xs text-center text-amber-600">
            {!emailVerified && !photoUploaded ? "Verifique seu e-mail e envie uma foto para continuar." :
             !emailVerified ? "Verifique seu e-mail para continuar." : "Envie uma foto para continuar."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Criteria Slider Component ───
const SCORE_LABELS: Record<string, string> = {
  "0.00": "0.0",
  "0.25": "0.25",
  "0.50": "0.5",
  "0.75": "0.75",
  "1.00": "1.0",
};

const PENALTY_LABELS: Record<string, string> = {
  "0.00": "0.0",
  "0.25": "0.25",
  "0.50": "0.5",
  "0.75": "0.75",
  "1.00": "1.0",
};

function getScoreLabel(value: number, penalty?: boolean): string {
  const labels = penalty ? PENALTY_LABELS : SCORE_LABELS;
  return labels[value.toFixed(2)] ?? value.toFixed(2);
}

function CriteriaSlider({ label, sublabel, tooltip, value, onChange, penalty, gender = "masc" }: { label: string; sublabel?: string; tooltip?: string; value: number; onChange: (v: number) => void; penalty?: boolean; gender?: "fem" | "masc" }) {
  const color = penalty
    ? (value >= 0.75 ? "text-red-600" : value >= 0.5 ? "text-amber-600" : "text-emerald-600")
    : (value >= 0.75 ? "text-emerald-600" : value >= 0.5 ? "text-amber-600" : "text-red-600");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {sublabel && <span className="text-xs text-muted-foreground ml-1">({sublabel})</span>}
        </div>
        <span className={`text-sm font-bold ${color}`}>{getScoreLabel(value, penalty)}</span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.25}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs font-medium">
        {penalty ? (
          <>
            <span className="text-emerald-600">0.0</span>
            <span className="text-lime-600">0.25</span>
            <span className="text-amber-500">0.5</span>
            <span className="text-orange-600">0.75</span>
            <span className="text-red-600">1.0</span>
          </>
        ) : (
          <>
            <span className="text-red-600">0.0</span>
            <span className="text-orange-500">0.25</span>
            <span className="text-amber-500">0.5</span>
            <span className="text-lime-600">0.75</span>
            <span className="text-emerald-600">1.0</span>
          </>
        )}
      </div>
    </div>
  );
}
