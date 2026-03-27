import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, Send, CheckCircle2, AlertTriangle, ArrowLeft, BookOpen, HelpCircle, Camera, Mail, ShieldCheck, Upload, ClipboardList, Clock, GraduationCap, User, History, Users, KeyRound, RefreshCw, LogOut, Edit, Lightbulb } from "lucide-react";
import BrainstormBoardPage from "./BrainstormBoardPage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { resizeImageToSquare, base64SizeKB } from "@/lib/resizeImage";
import { StudentPhotoAvatar } from "@/components/StudentPhotoModal";

type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

interface StudentEval {
  evaluatedStudentId: number;
  pontualidade: number;
  pesquisaMetas: number;
  dominio: number;
  participacao: number;
  desempenhoPapel: number;
}

// Flow steps:
// login → (first access: no email) → setupProfile → verifySetupEmail → dashboard
// login → (has email) → verifyCode → dashboard
// dashboard → evaluate → done → dashboard
// dashboard → editProfile → dashboard
// dashboard → brainstorm → dashboard
type Step = "login" | "setupProfile" | "verifySetupEmail" | "verifyCode" | "dashboard" | "editProfile" | "evaluate" | "done" | "brainstorm";

interface LoginData {
  studentId: number;
  studentName: string;
  studentEnrollment: string;
  hasEmail: boolean;
  hasPhoto: boolean;
  maskedEmail: string | null;
  codeSent: boolean;
}

interface AuthenticatedData {
  studentId: number;
  studentName: string;
  studentEmail: string | null;
  studentEnrollment: string;
  studentPhotoUrl: string | null;
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
  studentRole?: string;
}

// ─── Student session persistence ───
const STUDENT_SESSION_KEY = "student_auth_session";
const STUDENT_SESSION_TTL_3H = 3 * 60 * 60 * 1000;   // 3 hours (default)
const STUDENT_SESSION_TTL_24H = 24 * 60 * 60 * 1000; // 24 hours (remember me)
function loadStudentSession(): AuthenticatedData | null {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: AuthenticatedData; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STUDENT_SESSION_KEY);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}
function saveStudentSession(data: AuthenticatedData, rememberMe = false) {
  const ttl = rememberMe ? STUDENT_SESSION_TTL_24H : STUDENT_SESSION_TTL_3H;
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({ data, expiresAt: Date.now() + ttl, rememberMe }));
}
function clearStudentSession() {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

export default function StudentAccessPage() {
  const savedSession = loadStudentSession();
  const [step, setStep] = useState<Step>(savedSession ? "dashboard" : "login");
  const [enrollment, setEnrollment] = useState("");
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [authData, setAuthData] = useState<AuthenticatedData | null>(savedSession);
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [brainstormSession, setBrainstormSession] = useState<{ sessionId: number; sessionLabel: string; canEdit: boolean } | null>(null);
  const [pendingBrainstormSessionId, setPendingBrainstormSessionId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('brainstorm') === '1' && params.get('sessionId')) {
      return parseInt(params.get('sessionId')!, 10);
    }
    return null;
  });

  // Auto-open brainstorm board after login if URL has brainstorm=1&sessionId=X
  useEffect(() => {
    if (step === 'dashboard' && authData && pendingBrainstormSessionId) {
      // canEdit is determined when the brainstorm page loads based on session status
      setBrainstormSession({
        sessionId: pendingBrainstormSessionId,
        sessionLabel: `Sessão #${pendingBrainstormSessionId}`,
        canEdit: false, // Will be determined by BrainstormBoardPage based on session status
      });
      setStep('brainstorm');
      setPendingBrainstormSessionId(null);
      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [step, authData, pendingBrainstormSessionId]);

  // Step 1: Login by enrollment
  const loginMutation = trpc.studentAccess.loginByEnrollment.useMutation({
    onSuccess: (data) => {
      setLoginData(data);
      if (!data.hasEmail) {
        // First access: needs to set up email + photo
        setStep("setupProfile");
      } else {
        // Has email: code was sent automatically
        if (data.codeSent) {
          toast.success(`Código enviado para ${data.maskedEmail}`);
        } else {
          toast.error("Não foi possível enviar o código. Verifique a configuração de e-mail com o administrador.");
        }
        setStep("verifyCode");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Step 2a: Verify login code
  const verifyLoginCodeMutation = trpc.studentAccess.verifyLoginCode.useMutation({
    onSuccess: (data) => {
      setAuthData(data);
      saveStudentSession(data, rememberMe);
      toast.success("Acesso autorizado!");
      setStep("dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  // Resend code
  const resendCodeMutation = trpc.studentAccess.resendLoginCode.useMutation({
    onSuccess: () => toast.success("Novo código enviado!"),
    onError: (e) => toast.error(e.message),
  });

  const handleLogin = () => {
    if (!enrollment.trim()) { toast.error("Digite sua matrícula"); return; }
    loginMutation.mutate({ enrollment: enrollment.trim() });
  };

  const handleLogout = () => {
    clearStudentSession();
    setStep("login");
    setLoginData(null);
    setAuthData(null);
    setEnrollment("");
    setSelectedSession(null);
  };

  const handleProfileSetupComplete = (data: AuthenticatedData) => {
    setAuthData(data);
    saveStudentSession(data, rememberMe);
    setStep("dashboard");
  };

  const handleSelectSession = (session: SelectedSession) => {
    setSelectedSession(session);
    setStep("evaluate");
  };

  const handleEvalDone = () => {
    setSelectedSession(null);
    setStep("done");
  };

  const handleBackToDashboard = () => {
    setSelectedSession(null);
    setStep("dashboard");
  };

  // ─── Step: Login (enter enrollment) ───
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
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
              <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                Manter acesso por 24 horas neste computador
              </Label>
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
            <p className="text-center text-xs text-muted-foreground">
              Sem a opção marcada, o acesso expira automaticamente em <strong>3 horas</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step: Verify Code (has email, code sent) ───
  if (step === "verifyCode" && loginData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <VerifyCodeScreen
          loginData={loginData}
          onVerify={(code) => verifyLoginCodeMutation.mutate({ studentId: loginData.studentId, code })}
          onResend={() => resendCodeMutation.mutate({ studentId: loginData.studentId })}
          onBack={handleLogout}
          isVerifying={verifyLoginCodeMutation.isPending}
          isResending={resendCodeMutation.isPending}
        />
      </div>
    );
  }

  // ─── Step: Setup Profile (first access, no email) ───
  if (step === "setupProfile" && loginData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 flex items-center justify-center">
        <FirstAccessSetup
          studentId={loginData.studentId}
          studentName={loginData.studentName}
          onComplete={handleProfileSetupComplete}
          onBack={handleLogout}
        />
      </div>
    );
  }

  // ─── Step: Verify Setup Email (after first access setup) ───
  if (step === "verifySetupEmail" && loginData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <VerifyCodeScreen
          loginData={loginData}
          onVerify={(code) => verifyLoginCodeMutation.mutate({ studentId: loginData.studentId, code })}
          onResend={() => resendCodeMutation.mutate({ studentId: loginData.studentId })}
          onBack={handleLogout}
          isVerifying={verifyLoginCodeMutation.isPending}
          isResending={resendCodeMutation.isPending}
        />
      </div>
    );
  }

  // ─── Step: Edit Profile (from dashboard) ───
  if (step === "editProfile" && authData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 flex items-center justify-center">
        <EditProfileScreen
          studentId={authData.studentId}
          studentName={authData.studentName}
          currentEmail={authData.studentEmail || ""}
          currentPhotoUrl={authData.studentPhotoUrl || null}
          onComplete={(email, photoUrl) => {
            setAuthData(prev => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                studentEmail: email || prev.studentEmail,
                studentPhotoUrl: photoUrl || prev.studentPhotoUrl,
              };
              saveStudentSession(updated, rememberMe);
              return updated;
            });
            setStep("dashboard");
          }}
          onBack={() => setStep("dashboard")}
        />
      </div>
    );
  }

  // ─── Step: Brainstorm ───
  if (step === "brainstorm" && authData && brainstormSession) {
    return (
      <BrainstormBoardPage
        sessionId={brainstormSession.sessionId}
        studentId={authData.studentId}
        sessionLabel={brainstormSession.sessionLabel}
        canEdit={brainstormSession.canEdit}
        onBack={() => { setBrainstormSession(null); setStep("dashboard"); }}
      />
    );
  }

  // ─── Step: Dashboard ───
  if (step === "dashboard" && authData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <StudentDashboard
          authData={authData}
          onSelectSession={handleSelectSession}
          onOpenBrainstorm={(sessionId, sessionLabel, canEdit) => {
            setBrainstormSession({ sessionId, sessionLabel, canEdit });
            setStep("brainstorm");
          }}
          onEditProfile={() => setStep("editProfile")}
          onLogout={handleLogout}
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
  if (step === "evaluate" && authData && selectedSession) {
    const sessionStatus = (selectedSession as any).sessionStatus;
    if (sessionStatus === "finished") {
      // Session is finished — show read-only view
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="icon" onClick={handleBackToDashboard}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{selectedSession.sessionLabel}</h1>
                <p className="text-sm text-muted-foreground">{selectedSession.componentCode} - {selectedSession.classCode}</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-700 mb-2">Sessão Encerrada</h2>
              <p className="text-sm text-muted-foreground">Esta sessão foi encerrada. A avaliação não pode mais ser modificada.</p>
            </div>
          </div>
        </div>
      );
    }
    if (sessionStatus === "closed") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
          <DesempenhoPapelFormInline
            studentInfo={{
              studentId: authData.studentId,
              studentName: authData.studentName,
              sessionId: selectedSession.sessionId,
              sessionLabel: selectedSession.sessionLabel,
              classId: selectedSession.classId,
            }}
            sessionInfo={{
              sessionId: selectedSession.sessionId,
              label: selectedSession.sessionLabel,
              classCode: selectedSession.classCode,
              componentCode: selectedSession.componentCode,
              componentName: selectedSession.componentName,
            }}
            alreadySubmitted={!!(selectedSession as any).alreadySubmitted}
            onBack={handleBackToDashboard}
          />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <EvaluationForm          studentInfo={{
            studentId: authData.studentId,
            studentName: authData.studentName,
            sessionId: selectedSession.sessionId,
            sessionLabel: selectedSession.sessionLabel,
            classId: selectedSession.classId,
          }}
          sessionInfo={{
            sessionId: selectedSession.sessionId,
            label: selectedSession.sessionLabel,
            classCode: selectedSession.classCode,
            componentCode: selectedSession.componentCode,
            componentName: selectedSession.componentName,
            semester: selectedSession.semester,
          }}
          studentEmail={authData.studentEmail || ""}
          studentPhotoUrl={authData.studentPhotoUrl || null}
          onDone={handleEvalDone}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={handleLogout}>Voltar ao Login</Button>
    </div>
  );
}

// ─── Verify Code Screen ───
function VerifyCodeScreen({ loginData, onVerify, onResend, onBack, isVerifying, isResending }: {
  loginData: LoginData;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  isVerifying: boolean;
  isResending: boolean;
}) {
  const [code, setCode] = useState("");

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3">
          <KeyRound className="h-7 w-7 text-blue-600" />
        </div>
        <CardTitle className="text-xl">Verificação de Acesso</CardTitle>
        <CardDescription>
          Olá, <strong>{loginData.studentName}</strong>! Um código de 6 dígitos foi enviado para <strong>{loginData.maskedEmail}</strong>. Digite-o abaixo para acessar o sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="code">Código de Verificação</Label>
          <Input
            id="code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && onVerify(code)}
            maxLength={6}
            className="mt-1 text-center text-3xl tracking-[0.5em] font-mono"
            autoFocus
          />
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={() => onVerify(code)}
          disabled={code.length !== 6 || isVerifying}
        >
          {isVerifying ? "Verificando..." : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verificar Código
            </>
          )}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={onResend}
            disabled={isResending}
            className="text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
            {isResending ? "Enviando..." : "Reenviar código"}
          </button>
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        </div>
        {!loginData.codeSent && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            O código não pôde ser enviado automaticamente. Clique em "Reenviar código" ou entre em contato com o administrador.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── First Access Setup (email + photo, mandatory) ───
function FirstAccessSetup({ studentId, studentName, onComplete, onBack }: {
  studentId: number;
  studentName: string;
  onComplete: (data: AuthenticatedData) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
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
    onSuccess: (data) => { setPhotoUploaded(true); setUploadedPhotoUrl(data.photoUrl); setPhotoPreview(data.photoUrl); toast.success("Foto salva!"); },
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
      toast.success(`Foto redimensionada (~${base64SizeKB(resized.base64)}KB)`);
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const handleUploadPhoto = () => {
    if (!photoFile) return;
    uploadPhotoMutation.mutate({ studentId, photoBase64: photoFile.base64, mimeType: photoFile.mimeType });
  };

  const canProceed = emailVerified && photoUploaded;

  const handleComplete = async () => {
    // Fetch full student data after setup
    const classes = await new Promise<AuthenticatedData["classes"]>((resolve) => {
      // We'll use the verified data directly
      resolve([]);
    });
    onComplete({
      studentId,
      studentName,
      studentEmail: email,
      studentEnrollment: "",
      studentPhotoUrl: uploadedPhotoUrl,
      classes: [],
    });
  };

  // After completing setup, we need to get full student data via verifyLoginCode
  // So we'll send a new code and verify it
  const completeSetupMutation = trpc.studentAccess.resendLoginCode.useMutation({
    onSuccess: () => {
      toast.success("Código de acesso enviado para " + email);
    },
    onError: () => {
      // Even if resend fails, we can still proceed since email is verified
      toast.info("Prosseguindo...");
    },
  });

  const verifyLoginMutation = trpc.studentAccess.verifyLoginCode.useMutation({
    onSuccess: (data) => {
      onComplete(data);
    },
    onError: (e) => toast.error(e.message),
  });

  const [finalCode, setFinalCode] = useState("");
  const [showFinalVerify, setShowFinalVerify] = useState(false);

  const handleProceed = () => {
    // Send a login code to the verified email
    completeSetupMutation.mutate({ studentId });
    setShowFinalVerify(true);
  };

  if (showFinalVerify) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <KeyRound className="h-7 w-7 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Último Passo</CardTitle>
          <CardDescription>
            Um código de acesso foi enviado para <strong>{email}</strong>. Digite-o para completar o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="finalCode">Código de Acesso</Label>
            <Input
              id="finalCode"
              placeholder="000000"
              value={finalCode}
              onChange={(e) => setFinalCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && finalCode.length === 6 && verifyLoginMutation.mutate({ studentId, code: finalCode })}
              maxLength={6}
              className="mt-1 text-center text-3xl tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => verifyLoginMutation.mutate({ studentId, code: finalCode })}
            disabled={finalCode.length !== 6 || verifyLoginMutation.isPending}
          >
            {verifyLoginMutation.isPending ? "Verificando..." : "Acessar Sistema"}
          </Button>
          <button
            onClick={() => completeSetupMutation.mutate({ studentId })}
            disabled={completeSetupMutation.isPending}
            className="text-sm text-primary hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${completeSetupMutation.isPending ? "animate-spin" : ""}`} />
            Reenviar código
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mb-3">
          <ShieldCheck className="h-7 w-7 text-purple-600" />
        </div>
        <CardTitle className="text-xl">Primeiro Acesso</CardTitle>
        <CardDescription>
          Olá, <strong>{studentName}</strong>! Para acessar o sistema, precisamos do seu e-mail e uma foto. O e-mail será usado para enviar códigos de acesso e suas notas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* E-mail com verificação */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mail <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
          </Label>
          <p className="text-xs text-muted-foreground">Informe seu e-mail para receber os códigos de acesso e as notas das avaliações.</p>
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
            Foto <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
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
            onClick={handleProceed}
            disabled={!canProceed || completeSetupMutation.isPending}
            className="flex-1"
          >
            {completeSetupMutation.isPending ? "Preparando..." : "Continuar"}
          </Button>
        </div>
        {!canProceed && (
          <p className="text-xs text-center text-amber-600">
            {!emailVerified && !photoUploaded ? "Verifique seu e-mail e envie uma foto para continuar." :
             !emailVerified ? "Verifique seu e-mail para continuar." : "Envie uma foto para continuar."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Edit Profile Screen (from dashboard) ───
function EditProfileScreen({ studentId, studentName, currentEmail, currentPhotoUrl, onComplete, onBack }: {
  studentId: number;
  studentName: string;
  currentEmail: string;
  currentPhotoUrl: string | null;
  onComplete: (email: string | null, photoUrl: string | null) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(currentEmail || "");
  const [emailVerified, setEmailVerified] = useState(!!currentEmail);
  const [emailChanged, setEmailChanged] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(currentPhotoUrl);
  const [photoFile, setPhotoFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(!!currentPhotoUrl);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendCodeMutation = trpc.studentAccess.sendEmailVerification.useMutation({
    onSuccess: () => { setCodeSent(true); toast.success("Código enviado para " + email); },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar código"),
  });

  const verifyCodeMutation = trpc.studentAccess.verifyEmailCode.useMutation({
    onSuccess: () => { setEmailVerified(true); setEmailChanged(true); toast.success("E-mail atualizado e verificado!"); },
    onError: (e: any) => toast.error(e.message || "Código inválido"),
  });

  const uploadPhotoMutation = trpc.studentAccess.uploadPhoto.useMutation({
    onSuccess: (data) => { setPhotoUploaded(true); setNewPhotoUrl(data.photoUrl); setPhotoPreview(data.photoUrl); toast.success("Foto salva!"); },
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
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mb-3">
          <Edit className="h-7 w-7 text-purple-600" />
        </div>
        <CardTitle className="text-xl">Editar Perfil</CardTitle>
        <CardDescription>
          Atualize seu e-mail ou foto. Ao alterar o e-mail, será necessário verificá-lo novamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* E-mail */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> E-mail
          </Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="seu.email@ecomp.uefs.br"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value.toLowerCase() !== currentEmail.toLowerCase()) {
                  setEmailVerified(false); setCodeSent(false); setVerificationCode("");
                } else {
                  setEmailVerified(true);
                }
              }}
              disabled={emailVerified && !emailChanged && email === currentEmail}
              className="flex-1"
            />
            {!emailVerified && email !== currentEmail && (
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
              <p className="text-sm text-muted-foreground">Digite o código enviado para <strong>{email}</strong>:</p>
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
            <Camera className="h-4 w-4" /> Foto
          </Label>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-purple-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <Camera className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                {photoPreview ? "Trocar Foto" : "Enviar Foto"}
              </Button>
              {photoFile && !photoUploaded && (
                <Button size="sm" onClick={() => uploadPhotoMutation.mutate({ studentId, photoBase64: photoFile.base64, mimeType: photoFile.mimeType })} disabled={uploadPhotoMutation.isPending}>
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
            onClick={() => onComplete(emailChanged ? email : null, newPhotoUrl)}
            className="flex-1"
          >
            Salvar e Voltar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Student Dashboard Component ───
function StudentDashboard({ authData, onSelectSession, onOpenBrainstorm, onEditProfile, onLogout }: {
  authData: AuthenticatedData;
  onSelectSession: (session: SelectedSession) => void;
  onOpenBrainstorm: (sessionId: number, sessionLabel: string, canEdit: boolean) => void;
  onEditProfile: () => void;
  onLogout: () => void;
}) {
  const { data: openSessions, isLoading } = trpc.studentAccess.myOpenSessions.useQuery(
    { studentId: authData.studentId },
    { refetchInterval: 15000 }
  );
  const { data: evalHistory, isLoading: historyLoading } = trpc.studentAccess.myEvaluationHistory.useQuery(
    { studentId: authData.studentId },
  );

  // Sessões abertas sem avaliação submetida
  const pendingOpenSessions = openSessions?.filter(s => s.sessionStatus === "open" && !s.alreadySubmitted) || [];
  // Sessões fechadas com Mesa para reavaliar (qualquer aluno presente, incluindo quem já submeteu)
  const pendingMesaReview = openSessions?.filter(s => s.sessionStatus === "closed" && (s as any).hasMesaToReview) || [];
  // Sessões avaliadas (open + já submeteu) ou fechadas sem Mesa
  const completedSessions = openSessions?.filter(s => {
    if (s.sessionStatus === "open" && s.alreadySubmitted) return true;
    if (s.sessionStatus === "closed" && !(s as any).hasMesaToReview) return true;
    return false;
  }) || [];
  const pendingSessions = [...pendingOpenSessions, ...pendingMesaReview];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Painel do Aluno
        </h1>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>

      {/* Profile Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <StudentPhotoAvatar
              photoUrl={authData.studentPhotoUrl}
              studentName={authData.studentName}
              size="lg"
              borderClass="border-2 border-blue-200"
              clickable={false}
            />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{authData.studentName}</p>
              <p className="text-sm text-muted-foreground truncate">{authData.studentEmail || "E-mail não informado"}</p>
              <p className="text-xs text-muted-foreground">Matrícula: {authData.studentEnrollment}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Open Sessions - Pending */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-600" />
          Sessões Pendentes
        </h3>
        {isLoading ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Carregando sessões...
            </CardContent>
          </Card>
        ) : pendingSessions.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-sm">Nenhuma sessão pendente</p>
              <p className="text-xs mt-1">Quando o professor abrir uma sessão, ela aparecerá aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingSessions.map(s => {
              const isClosed = (s as any).sessionStatus === "closed";
              const isMesaReview = isClosed && (s as any).hasMesaToReview;
              return (
                <Card key={s.sessionId} className={isMesaReview ? "border-orange-200 hover:border-orange-300 transition-colors" : "border-amber-200 hover:border-amber-300 transition-colors"}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => onSelectSession(s as any)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{s.sessionLabel}</p>
                        <p className="text-xs text-muted-foreground">{s.componentCode} - {s.classCode} ({s.semester})</p>
                        {isMesaReview && (
                          <p className="text-xs text-orange-600 mt-0.5">Sessão fechada — reavaliar desempenho da Mesa</p>
                        )}
                      </div>
                      {isMesaReview ? (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 shrink-0">
                          <Clock className="h-3 w-3 mr-1" /> Reavaliar Mesa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-amber-700 shrink-0">
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </div>
                    {!isMesaReview && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Mesa can edit only if session is not finished
                            const sessionStatus = (s as any).sessionStatus;
                            const canEdit = (s as any).studentRole === "MESA" && sessionStatus !== "finished";
                            onOpenBrainstorm(s.sessionId, s.sessionLabel, canEdit);
                          }}
                        >
                          <Lightbulb className="h-3 w-3 mr-1" />
                          {(s as any).studentRole === "MESA" ? "Editar Brainstorming" : "Ver Brainstorming"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Sessões Avaliadas
          </h3>
          <div className="space-y-2">
            {completedSessions.map(s => (
              <Card key={s.sessionId} className="border-emerald-100">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{s.sessionLabel}</p>
                      <p className="text-xs text-muted-foreground">{s.componentCode} - {s.classCode} ({s.semester})</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Avaliado
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* History by Component */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          Histórico por Componente
        </h3>
        {historyLoading ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Carregando histórico...
            </CardContent>
          </Card>
        ) : !evalHistory || !('byComponent' in evalHistory) || evalHistory.byComponent.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-sm">Nenhuma sessão registrada ainda</p>
              <p className="text-xs mt-1">Seu histórico de sessões e notas aparecerá aqui após participar de sessões tutoriais.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(evalHistory.byComponent as Array<{
              componentCode: string;
              componentName: string;
              classCode: string;
              semester: string;
              sessions: Array<{
                sessionId: number;
                sessionLabel: string;
                sessionStatus: string;
                problemNumber: number;
                sessionNumber: number;
                role: string;
                peerScore: number;
                tutorialScore?: number;
                desempenhoScore: number;
                absent: boolean;
                hasSubmitted: boolean;
                submittedAt: Date | null;
              }>;
              problemAverages: Array<{ problemNumber: number; problemTitle: string; average: number; sessionCount: number; capped?: boolean }>;
            }>).map((comp) => (
              <Card key={`${comp.componentCode}|${comp.classCode}|${comp.semester}`} className="border-blue-100">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div>
                    <CardTitle className="text-base font-semibold">{comp.componentCode}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{comp.componentName}</p>
                    <p className="text-xs text-muted-foreground">{comp.classCode} &bull; {comp.semester}</p>
                    {(() => {
                      const absences = comp.sessions.filter(s => s.absent).length;
                      return absences > 0 ? (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <span>✗</span> Faltas: <strong>{absences}</strong>
                        </p>
                      ) : null;
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Sessions table */}
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Sessão</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Papel</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Nota Pares</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Nota Tutorial</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Nota Desempenho</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Avaliou</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comp.sessions.map((ev, idx) => {
                          const canEditBrainstorm = ev.role === 'MESA' && ev.sessionStatus !== 'finished';
                          const canEval = ev.sessionStatus === 'open' || ev.sessionStatus === 'closed';
                          const evalDone = ev.hasSubmitted;
                          return (
                          <tr key={`${ev.sessionId}-${idx}`} className={`border-b last:border-0 ${
                            ev.absent ? 'bg-red-50/40' : ''
                          }`}>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium">{ev.sessionLabel}</p>
                                {ev.absent && (
                                  <Badge variant="outline" className="text-red-600 border-red-200 text-[9px] px-1 py-0">Faltou</Badge>
                                )}
                              </div>
                              <Badge variant={ev.sessionStatus === 'finished' ? 'secondary' : 'outline'} className="text-[9px] px-1 py-0 mt-0.5">
                                {ev.sessionStatus === 'finished' ? 'Encerrada' : ev.sessionStatus === 'closed' ? 'Fechada' : ev.sessionStatus === 'open' ? 'Em Avaliação' : 'Ativa'}
                              </Badge>
                              {/* Action buttons */}
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5 py-0"
                                  onClick={() => onOpenBrainstorm(ev.sessionId, ev.sessionLabel, canEditBrainstorm)}
                                >
                                  <Lightbulb className="h-2.5 w-2.5 mr-0.5" />
                                  {canEditBrainstorm ? 'Editar' : 'Ver'} Quadro
                                </Button>
                                {!ev.absent && (
                                  <Button
                                    variant={canEval && !evalDone ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-5 text-[9px] px-1.5 py-0"
                                    disabled={ev.sessionStatus === 'active'}
                                    onClick={() => {
                                      if (ev.sessionStatus === 'active') return;
                                      onSelectSession({
                                        sessionId: ev.sessionId,
                                        sessionLabel: ev.sessionLabel,
                                        classId: 0,
                                        classCode: comp.classCode,
                                        componentCode: comp.componentCode,
                                        componentName: comp.componentName,
                                        semester: comp.semester,
                                        studentRole: ev.role,
                                        sessionStatus: ev.sessionStatus,
                                        alreadySubmitted: ev.hasSubmitted,
                                      } as any);
                                    }}
                                  >
                                    <ClipboardList className="h-2.5 w-2.5 mr-0.5" />
                                    {ev.sessionStatus === 'active' ? 'Aguardando' : evalDone ? 'Ver Avaliação' : 'Avaliar'}
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-muted-foreground">
                                {ev.role === 'FALTOU' ? '—' : ev.role === 'COORDENADOR' ? 'Coord.' : ev.role === 'MESA' ? 'Mesa' : ev.role === 'QUADRO' ? 'Quadro' : 'Part.'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {ev.absent ? (
                                <span className="text-muted-foreground font-medium">0.0</span>
                              ) : (ev.sessionStatus === 'finished' || ev.sessionStatus === 'closed') && ev.peerScore > 0 ? (
                                <span className="text-slate-700">{ev.peerScore.toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {ev.absent ? (
                                <span className="text-muted-foreground font-medium">0.0</span>
                              ) : ev.sessionStatus === 'finished' && ev.tutorialScore !== undefined ? (
                                <span className="text-slate-700">{ev.tutorialScore.toFixed(1)}</span>
                              ) : ev.sessionStatus === 'closed' ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 text-[10px]" title="Avaliação tutorial ainda não realizada pelo professor">
                                  ⏳ Pendente
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {ev.absent ? (
                                <span className="text-muted-foreground font-semibold">0.0</span>
                              ) : ev.sessionStatus === 'finished' || ev.sessionStatus === 'closed' ? (
                                <span className="font-semibold text-blue-700">{(ev.desempenhoScore ?? ev.desempenhoScore).toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">Pendente</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {ev.absent ? (
                                <span className="text-muted-foreground">—</span>
                              ) : ev.hasSubmitted ? (
                                <span className="text-emerald-600">✓</span>
                              ) : (
                                <span className="text-orange-500">✗</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Problem averages */}
                  {comp.problemAverages.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Média por Problema</p>
                      <div className="grid grid-cols-2 gap-2">
                        {comp.problemAverages.map((p) => (
                          <div key={p.problemNumber} className="rounded-md bg-blue-50/60 border border-blue-100 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground font-medium">Problema {p.problemNumber}{p.problemTitle ? ` — ${p.problemTitle}` : ''}</p>
                            <p className="text-lg font-bold text-blue-700 leading-tight flex items-center gap-1">
                              {p.average.toFixed(1)}
                              {p.capped && (
                                <span title="Nota máxima: 10.0 (média bruta excedeu o limite)" className="text-amber-500 cursor-help" style={{fontSize: '0.75rem'}}>★</span>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{p.sessionCount} sess{p.sessionCount === 1 ? 'ão' : 'ões'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
function EvaluationForm({ studentInfo, sessionInfo, studentEmail, studentPhotoUrl, onDone, onBack }: {
  studentInfo: { studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number };
  sessionInfo: { sessionId: number; label: string; classCode: string; componentCode: string; componentName: string; semester: string };
  studentEmail: string;
  studentPhotoUrl: string | null;
  onDone: () => void;
  onBack: () => void;
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

  // Only evaluate non-absent peers
  const activePeers = useMemo(() => {
    return peersToEvaluate.filter(p => !p.absent);
  }, [peersToEvaluate]);

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

  const roleLabels: Record<string, string> = { COORDENADOR: "Coordenador", MESA: "Mesa", QUADRO: "Quadro", PARTICIPANTE: "Participante" };
  const totalPeers = activePeers.length;
  const absentPeers = peersToEvaluate.filter(p => p.absent).length;

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
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
            <strong>Importante:</strong> O preenchimento deste formulário é um requisito obrigatório para obtenção da nota de desempenho da sessão tutorial do componente. Avalie de forma objetiva e imparcial, baseando-se apenas nas contribuições e discussões ocorridas durante a sessão tutorial.
          </p>
        </div>
      </div>

      {/* Profile info card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <StudentPhotoAvatar
              photoUrl={studentPhotoUrl}
              studentName={studentInfo.studentName}
              size="md"
              borderClass="border-2 border-blue-200"
              clickable={false}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{studentEmail || "E-mail não informado"}</p>
              <p className="text-xs text-muted-foreground">
                {sessionInfo.componentCode} - {sessionInfo.classCode} ({sessionInfo.semester})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-sm">
            <span>Avaliando <strong>{totalPeers}</strong> colega{totalPeers !== 1 ? "s" : ""} {absentPeers > 0 && <span className="text-muted-foreground">({absentPeers} ausente{absentPeers !== 1 ? "s" : ""})</span>}</span>
            <div className="flex gap-2">
              {activePeers.filter(p => ["COORDENADOR", "MESA", "QUADRO"].includes(p.role)).map(p => (
                <Badge key={p.role} variant="outline" className="text-xs">{roleLabels[p.role]}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {activePeers.map(peer => {
        const ev = evaluations[peer.studentId];
        if (!ev) return null;
        const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(peer.role);
        const totalScore = ev.pontualidade * 1 + ev.pesquisaMetas * 3 + ev.dominio * 3 + ev.participacao * 3 - (hasRolePenalty ? ev.desempenhoPapel * 1 : 0);

        return (
          <Card key={peer.studentId} className="transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StudentPhotoAvatar
                    photoUrl={peer.studentPhotoUrl}
                    studentName={peer.studentName}
                    size="md"
                  />
                  <div>
                    <CardTitle className="text-base">{peer.studentName}</CardTitle>
                    <Badge variant={peer.role === "PARTICIPANTE" ? "secondary" : "default"} className="text-xs mt-1">
                      {roleLabels[peer.role]}
                    </Badge>
                  </div>
                </div>
                <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${totalScore >= 8 ? "border-emerald-300 text-emerald-700" : totalScore >= 5 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                  {totalScore.toFixed(1)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Separator />

              <TooltipProvider>
              <div className="space-y-4">
                <CriteriaSlider label="Pontualidade" sublabel="Peso 1" tooltip="Excelente: Estava presente desde o início do tutorial, cumprindo integralmente o horário. | Boa: Chegou com até 10 minutos de atraso em relação ao início do tutorial. | Razoável: Chegou com atraso considerável, mas antes da primeira hora. | Fraca: Chegou até uma hora e 10 minutos depois do início do tutorial. | Nenhuma: Chegou após uma hora e 10 minutos do início do tutorial." value={ev.pontualidade} onChange={(v) => updateEval(peer.studentId, "pontualidade", v)} gender="fem" />
                <CriteriaSlider label="Pesquisa / Metas" sublabel="Peso 3" tooltip="Excelente: Cumpriu todas as metas e pesquisas propostas e/ou realizou tarefas extras não solicitadas. | Boa: Realizou a pesquisa e cumpriu a maior parte das metas propostas de forma satisfatória. | Razoável: Cumpriu as metas apenas parcialmente ou realizou a pesquisa de forma superficial/insuficiente. | Fraca: Entregou resultados insuficientes para o grupo ou trouxe pesquisas irrelevantes para os objetivos do tutorial. | Nenhuma: Não realizou as pesquisas solicitadas nem cumpriu qualquer uma das metas estabelecidas." value={ev.pesquisaMetas} onChange={(v) => updateEval(peer.studentId, "pesquisaMetas", v)} gender="fem" />
                <CriteriaSlider label="Domínio do Assunto" sublabel="Peso 3" tooltip="Excelente: Trouxe novos conceitos e/ou corrigiu com clareza equívocos apresentados pelo grupo. | Bom: Compreendeu a maioria dos pontos e aplicou os conceitos discutidos com segurança. | Razoável: Demonstrou conhecimento básico, mas apresentou dificuldade para explicar ou fundamentar suas ideias. | Fraco: Citou conceitos novos ou termos da área, porém não soube explicá-los ou aplicá-los corretamente. | Nenhum: Atuou apenas como ouvinte e não demonstrou qualquer conhecimento sobre o tema proposto." value={ev.dominio} onChange={(v) => updateEval(peer.studentId, "dominio", v)} gender="masc" />
                <CriteriaSlider label="Participação" sublabel="Peso 3" tooltip="Excelente: Participou ativamente, estimulou o debate construtivo e contribuiu para o aprofundamento da discussão. | Boa: Contribuiu com as discussões de forma frequente, ouviu os colegas e fez perguntas pertinentes. | Razoável: Participou de forma pontual ou apenas quando solicitado, com poucas contribuições voluntárias. | Fraca: Contribuiu minimamente com o grupo e, em alguns momentos, dispersou a atenção ou atrapalhou o fluxo. | Nenhuma: Permaneceu em silêncio absoluto ou demonstrou total desinteresse pelas atividades e pelo grupo." value={ev.participacao} onChange={(v) => updateEval(peer.studentId, "participacao", v)} gender="fem" />
                {hasRolePenalty && (
                  <CriteriaSlider label="Desempenho no Papel" sublabel="Penalidade: até -1" tooltip={`Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial. | Excelente: Cumpriu todas as funções da forma esperada (ex: coordenador seguiu a pauta e gerenciou o tempo; quadro anotou os pontos principais com clareza; mesa registrou todos os dados e publicou prontamente). | Bom: Executou a maior parte das funções, mas falhou em pontos isolados. | Razoável: Tentou executar a função, mas deixou de realizar metade das tarefas. | Fraco: Realizou apenas tarefas mínimas ou superficiais, demonstrando desinteresse. | Nenhum: Não cumpriu as funções essenciais de sua responsabilidade.`} value={ev.desempenhoPapel} onChange={(v) => updateEval(peer.studentId, "desempenhoPapel", v)} penalty />
                )}
              </div>
              </TooltipProvider>
            </CardContent>
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

// ─── Criteria Slider Component ───
// Snap points (internal fraction 0–1): Nenhuma=0, Fraca=0.25, Razoável=0.5, Boa=0.75, Excelente=1.0
const CS_SNAP_POINTS = [0, 0.25, 0.5, 0.75, 1.0];

const CS_LABELS_FEM = [
  { label: "Nenhuma", value: 0 },
  { label: "Fraca", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Boa", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const CS_LABELS_MASC = [
  { label: "Nenhum", value: 0 },
  { label: "Fraco", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

// Penalidade: 0=sem penalidade (Excelente), 1=penalidade máxima (Nenhum)
// Exibido invertido: Nenhum à esquerda, Excelente à direita
const CS_LABELS_PENALTY = [
  { label: "Nenhum", value: 1.0 },
  { label: "Fraco", value: 0.75 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.25 },
  { label: "Excelente", value: 0.0 },
] as const;

function csGetTrackColor(v: number): string {
  if (v <= 0) return "#ef4444";
  if (v <= 0.25) return "#f97316";
  if (v <= 0.5) return "#f59e0b";
  if (v <= 0.75) return "#65a30d";
  return "#059669";
}

// For penalty: color is based on how bad the penalty is (value=0 → no penalty → green)
function csPenaltyTrackColor(v: number): string {
  if (v >= 1) return "#ef4444";
  if (v >= 0.75) return "#f97316";
  if (v >= 0.5) return "#f59e0b";
  if (v >= 0.25) return "#65a30d";
  return "#059669";
}

function csGetLabel(value: number, gender: "fem" | "masc", penalty?: boolean): string {
  if (penalty) {
    const match = CS_LABELS_PENALTY.find(l => Math.abs(l.value - value) < 0.01);
    return match?.label ?? value.toFixed(2);
  }
  const labels = gender === "masc" ? CS_LABELS_MASC : CS_LABELS_FEM;
  const match = labels.find(l => Math.abs(l.value - value) < 0.01);
  return match?.label ?? value.toFixed(2);
}

function csFractionToDisplay(v: number): string {
  return (Math.round(v * 100) / 10).toFixed(1);
}

function csDisplayToFraction(s: string): number | null {
  const n = parseFloat(s);
  if (isNaN(n) || n < 0 || n > 10) return null;
  return Math.round((n / 10) * 100) / 100;
}

function CriteriaSlider({ label, sublabel, tooltip, value, onChange, penalty, gender = "masc" }: {
  label: string;
  sublabel?: string;
  tooltip?: string;
  value: number;
  onChange: (v: number) => void;
  penalty?: boolean;
  gender?: "fem" | "masc";
}) {
  // For penalty: slider shows inverted (0=Excelente on right, 1=Nenhum on left)
  // sliderFrac: the fraction used for slider position (0=left, 1=right)
  const sliderFrac = penalty ? 1 - value : value;
  const trackColor = penalty ? csPenaltyTrackColor(value) : csGetTrackColor(value);
  const fillPct = sliderFrac * 100;

  const [inputText, setInputText] = useState(() => csFractionToDisplay(sliderFrac));
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!inputFocused) {
      setInputText(csFractionToDisplay(sliderFrac));
    }
  }, [sliderFrac, inputFocused]);

  const trackRef = useRef<HTMLDivElement>(null);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    const snapped = Math.round(raw * 10) / 100;
    const newValue = penalty ? 1 - snapped : snapped;
    onChange(newValue);
    setInputText(csFractionToDisplay(snapped));
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, raw));
    const snapped = Math.round(clamped * 10) / 10;
    const newValue = penalty ? 1 - snapped : snapped;
    onChange(newValue);
    setInputText(csFractionToDisplay(snapped));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    const frac = csDisplayToFraction(inputText);
    if (frac !== null) {
      const clamped = Math.min(1, Math.max(0, frac));
      const newValue = penalty ? 1 - clamped : clamped;
      onChange(newValue);
      setInputText(csFractionToDisplay(clamped));
    } else {
      setInputText(csFractionToDisplay(sliderFrac));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  // Labels for concept buttons
  const conceptLabels = penalty ? CS_LABELS_PENALTY : (gender === "masc" ? CS_LABELS_MASC : CS_LABELS_FEM);
  // For penalty, the slider position of each concept is (1 - value)
  const getConceptSliderPos = (conceptValue: number) => penalty ? 1 - conceptValue : conceptValue;

  return (
    <div className="space-y-3">
      {/* Header: label + tooltip + sublabel */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <div className="space-y-1">
                {tooltip.includes("|") ? tooltip.split(" | ").map((line, i) => {
                  const [concept, ...rest] = line.split(": ");
                  return rest.length > 0 ? (
                    <p key={i}><strong className="text-foreground">{concept}:</strong> {rest.join(": ")}</p>
                  ) : (
                    <p key={i}>{line}</p>
                  );
                }) : <p>{tooltip}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {sublabel && <span className="text-xs text-muted-foreground">({sublabel})</span>}
      </div>

      {/* Slider + numeric input row */}
      <div className="flex items-center gap-3 pt-1">
        {/* Slider container */}
        <div className="relative flex-1">
          <div
            ref={trackRef}
            className="relative h-6 flex items-center cursor-pointer"
            onClick={handleTrackClick}
          >
            {/* Track background */}
            <div className="absolute inset-y-0 left-0 right-0 my-auto h-2 rounded-full bg-muted" />
            {/* Filled track */}
            <div
              className="absolute left-0 my-auto h-2 rounded-full transition-all duration-100"
              style={{ width: `${fillPct}%`, top: 0, bottom: 0, margin: 'auto', backgroundColor: trackColor }}
            />
            {/* Tick marks for every tenth */}
            {Array.from({ length: 101 }, (_, i) => Math.round(i) / 100).map((tick) => {
              const isConcept = CS_SNAP_POINTS.includes(tick);
              const isActive = Math.abs(sliderFrac - tick) < 0.005;
              return (
                <div
                  key={tick}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${tick * 100}%`,
                    top: '50%',
                    transform: 'translateX(-50%) translateY(-50%)',
                  }}
                >
                  <div
                    style={{
                      width: isConcept ? '6px' : '3px',
                      height: isConcept ? '14px' : '8px',
                      borderRadius: '2px',
                      backgroundColor: isActive
                        ? 'white'
                        : isConcept
                        ? 'rgba(0,0,0,0.25)'
                        : 'rgba(0,0,0,0.15)',
                      opacity: isActive ? 0 : 1,
                    }}
                  />
                </div>
              );
            })}
            {/* Invisible range input for drag */}
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={sliderFrac * 10}
              onChange={handleSliderChange}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ margin: 0 }}
            />
            {/* Thumb */}
            <div
              className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md transition-all duration-100 pointer-events-none"
              style={{
                left: `${fillPct}%`,
                top: '50%',
                transform: 'translateX(-50%) translateY(-50%)',
                backgroundColor: trackColor,
              }}
            />
          </div>

          {/* Concept labels below snap points — clickable */}
          <div className="relative w-full mt-2">
            {conceptLabels.map((opt, idx) => {
              const sliderPos = getConceptSliderPos(opt.value);
              const isActive = Math.abs(sliderFrac - sliderPos) < 0.01;
              const labelColor = penalty ? csPenaltyTrackColor(opt.value) : csGetTrackColor(opt.value);
              const isFirst = idx === 0;
              const isLast = idx === conceptLabels.length - 1;
              const transformX = isFirst ? "0%" : isLast ? "-100%" : "-50%";
              return (
                <div
                  key={opt.value}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${sliderPos * 100}%`, transform: `translateX(${transformX})` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setInputText(csFractionToDisplay(sliderPos));
                    }}
                    className={cn(
                      "text-[9px] sm:text-[11px] whitespace-nowrap transition-all rounded px-0.5 py-0.5 sm:px-1",
                      "focus:outline-none focus:ring-1 focus:ring-ring",
                      isActive ? "font-bold" : "text-muted-foreground hover:font-semibold"
                    )}
                    style={{ color: isActive ? labelColor : undefined }}
                    title={`Definir como ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Numeric input — 0.0 to 10.0 scale */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={inputText}
            onChange={handleInputChange}
            onFocus={() => setInputFocused(true)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              "w-16 text-center text-base font-bold rounded-md border px-2 py-1 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "bg-background"
            )}
            style={{ color: trackColor, borderColor: trackColor }}
          />
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      </div>
      {/* Spacer for label row below slider */}
      <div className="h-5" />
    </div>
  );
}

// ─── Desempenho no Papel Form (inline, for closed sessions in dashboard flow) ───
const penaltyLabelsInline: Record<number, string> = {
  0: "Excelente", 0.25: "Bom", 0.5: "Razoável", 0.75: "Fraco", 1: "Nenhum",
};

function DesempenhoPapelFormInline({ studentInfo, sessionInfo, alreadySubmitted, onBack }: {
  studentInfo: { studentId: number; studentName: string; sessionId: number; sessionLabel: string; classId: number };
  sessionInfo: { sessionId: number; label: string; classCode: string; componentCode: string; componentName: string };
  alreadySubmitted: boolean;
  onBack: () => void;
}) {
  const { data: sessionStudentsList } = trpc.studentAccess.getSessionStudents.useQuery(
    { sessionId: studentInfo.sessionId },
    { enabled: !!studentInfo.sessionId }
  );

  const updateMutation = trpc.studentAccess.updateDesempenho.useMutation({
    onSuccess: () => {
      toast.success("Desempenho no papel atualizado com sucesso!");
      setDone(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const [done, setDone] = useState(false);
  const [desempenhos, setDesempenhos] = useState<Record<number, number>>({});
  const [initializedFromPrevious, setInitializedFromPrevious] = useState(false);

  const peersWithRole = useMemo(() => {
    if (!sessionStudentsList) return [];
    return sessionStudentsList.filter(
      s => s.studentId !== studentInfo.studentId && !s.absent && s.role === "MESA"
    );
  }, [sessionStudentsList, studentInfo.studentId]);

  // Fetch previous scores for each Mesa peer
  const mesaStudentId = peersWithRole.length > 0 ? peersWithRole[0].studentId : undefined;
  const { data: previousScoreData } = trpc.studentAccess.getPreviousMesaScore.useQuery(
    {
      sessionId: studentInfo.sessionId,
      evaluatorStudentId: studentInfo.studentId,
      mesaStudentId: mesaStudentId ?? 0,
    },
    { enabled: !!mesaStudentId }
  );

  // Initialize desempenhos with previous score (or 0 = Excelente as default)
  // Wait for both peersWithRole and previousScoreData to be available before initializing
  useEffect(() => {
    if (peersWithRole.length > 0 && !initializedFromPrevious) {
      // If the student has submitted before, wait for previousScoreData to arrive
      // If mesaStudentId is set but previousScoreData is still undefined, wait
      if (mesaStudentId && previousScoreData === undefined) return;
      const init: Record<number, number> = {};
      peersWithRole.forEach(p => {
        // previousScoreData.score is the previous desempenhoPapel value, or null if not submitted
        const prevScore = (p.studentId === mesaStudentId && previousScoreData !== undefined)
          ? (previousScoreData.score ?? 0)
          : 0;
        init[p.studentId] = prevScore;
      });
      setDesempenhos(init);
      setInitializedFromPrevious(true);
    }
  }, [peersWithRole, previousScoreData, initializedFromPrevious, mesaStudentId]);

  const handleSubmit = () => {
    const items = Object.entries(desempenhos).map(([id, val]) => ({
      evaluatedStudentId: Number(id),
      desempenhoPapel: val,
    }));
    updateMutation.mutate({
      sessionId: studentInfo.sessionId,
      evaluatorStudentId: studentInfo.studentId,
      items,
    });
  };

  if (done) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Desempenho Atualizado!</h2>
            <p className="text-muted-foreground mb-4">
              Sua avaliação de desempenho no papel da sessão <strong>{studentInfo.sessionLabel}</strong> foi registrada.
            </p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-100">
              <ClipboardList className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-amber-900">Avaliação de Desempenho no Papel</h1>
              <p className="text-sm text-amber-700 mt-1">
                {sessionInfo.componentCode} - {sessionInfo.classCode} &middot; {sessionInfo.label}
              </p>
              <p className="text-xs text-amber-600 mt-1.5">
                A sessão foi fechada. Você ainda pode avaliar o desempenho no papel dos colegas com funções especiais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Sobre este formulário</p>
              <p>A sessão foi encerrada para novas avaliações, mas você ainda pode atualizar a nota de <strong>Desempenho no Papel</strong> do colega que exerceu a função de <strong>Mesa</strong>.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {peersWithRole.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum colega com papel especial nesta sessão.</p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Painel
            </Button>
          </CardContent>
        </Card>
      )}

      {peersWithRole.map((peer) => {
        const val = desempenhos[peer.studentId] ?? 0;
        // Determine if this is a pre-filled value from a previous evaluation
        const hasPreviousScore = peer.studentId === mesaStudentId && previousScoreData?.score !== null && previousScoreData?.score !== undefined;
        return (
          <Card key={peer.studentId}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <StudentPhotoAvatar
                  photoUrl={(peer as any).studentPhotoUrl ?? null}
                  studentName={peer.studentName}
                  size="md"
                  borderClass="border-2 border-amber-200"
                  clickable={false}
                />
                <div className="flex-1">
                  <CardTitle className="text-base">{peer.studentName}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <CardDescription className="text-xs">{peer.studentEnrollment}</CardDescription>
                    <Badge variant="default" className="text-xs bg-green-600">{peer.role}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Separator />
              {/* Indicator: previous score or default */}
              {initializedFromPrevious && (
                <div className={`text-xs rounded-md px-3 py-2 flex items-center gap-2 ${
                  hasPreviousScore
                    ? "bg-blue-50 border border-blue-200 text-blue-700"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                }`}>
                  {hasPreviousScore ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Nota anterior: <strong>{penaltyLabelsInline[previousScoreData!.score!] ?? previousScoreData!.score}</strong>. Ajuste se desejar.</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Você não avaliou esta sessão anteriormente. Padrão: <strong>Excelente</strong>.</span>
                    </>
                  )}
                </div>
              )}
              <CriteriaSlider
                label="Desempenho no Papel"
                sublabel="Penalidade: até -1"
                tooltip="Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial. | Excelente: Cumpriu todas as funções da forma esperada (ex: coordenador seguiu a pauta e gerenciou o tempo; quadro anotou os pontos principais com clareza; mesa registrou todos os dados e publicou prontamente). | Bom: Executou a maior parte das funções, mas falhou em pontos isolados. | Razoável: Tentou executar a função, mas deixou de realizar metade das tarefas. | Fraco: Realizou apenas tarefas mínimas ou superficiais, demonstrando desinteresse. | Nenhum: Não cumpriu as funções essenciais de sua responsabilidade."
                value={val}
                onChange={(v) => setDesempenhos(prev => ({ ...prev, [peer.studentId]: v }))}
                penalty
              />
            </CardContent>
          </Card>
        );
      })}

      {peersWithRole.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-900">Confirmar atualização?</p>
                <p className="text-sm text-amber-700">{peersWithRole.length} colega(s) com papel especial</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={updateMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar Desempenho"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
