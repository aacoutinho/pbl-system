import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, Send, CheckCircle2, AlertTriangle, ArrowLeft, BookOpen, HelpCircle, Camera, Mail, ShieldCheck, Upload, ClipboardList, Clock, GraduationCap, User, History, Users, KeyRound, RefreshCw, LogOut, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo, useRef } from "react";
import { resizeImageToSquare, base64SizeKB } from "@/lib/resizeImage";

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
type Step = "login" | "setupProfile" | "verifySetupEmail" | "verifyCode" | "dashboard" | "editProfile" | "evaluate" | "done";

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
}

export default function StudentAccessPage() {
  const [step, setStep] = useState<Step>("login");
  const [enrollment, setEnrollment] = useState("");
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [authData, setAuthData] = useState<AuthenticatedData | null>(null);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);

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
    setStep("login");
    setLoginData(null);
    setAuthData(null);
    setEnrollment("");
    setSelectedSession(null);
  };

  const handleProfileSetupComplete = (data: AuthenticatedData) => {
    setAuthData(data);
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
            setAuthData(prev => prev ? {
              ...prev,
              studentEmail: email || prev.studentEmail,
              studentPhotoUrl: photoUrl || prev.studentPhotoUrl,
            } : prev);
            setStep("dashboard");
          }}
          onBack={() => setStep("dashboard")}
        />
      </div>
    );
  }

  // ─── Step: Dashboard ───
  if (step === "dashboard" && authData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <StudentDashboard
          authData={authData}
          onSelectSession={handleSelectSession}
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
function StudentDashboard({ authData, onSelectSession, onEditProfile, onLogout }: {
  authData: AuthenticatedData;
  onSelectSession: (session: SelectedSession) => void;
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
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>

      {/* Profile Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            {authData.studentPhotoUrl ? (
              <img src={authData.studentPhotoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border-2 border-blue-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                <User className="h-7 w-7 text-blue-400" />
              </div>
            )}
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
            {pendingSessions.map(s => (
              <Card key={s.sessionId} className="border-amber-200 hover:border-amber-300 cursor-pointer transition-colors" onClick={() => onSelectSession(s as any)}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{s.sessionLabel}</p>
                      <p className="text-xs text-muted-foreground">{s.componentCode} - {s.classCode} ({s.semester})</p>
                    </div>
                    <Badge variant="outline" className="border-amber-300 text-amber-700 shrink-0">
                      <Clock className="h-3 w-3 mr-1" /> Pendente
                    </Badge>
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
                  {peer.studentPhotoUrl ? (
                    <img src={peer.studentPhotoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-muted shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border-2 border-muted shrink-0">
                      <span className="text-sm font-medium text-muted-foreground">{peer.studentName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
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
                <CriteriaSlider label="Participação" sublabel="Peso 3" tooltip="Excelente: Participou ativamente, estimulou o debate construtivo e contribuiu para o aprofundamento da discussão. | Bom: Contribuiu com as discussões de forma frequente, ouviu os colegas e fez perguntas pertinentes. | Razoável: Participou de forma pontual ou apenas quando solicitado, com poucas contribuições voluntárias. | Fraco: Contribuiu minimamente com o grupo e, em alguns momentos, dispersou a atenção ou atrapalhou o fluxo. | Nenhum: Permaneceu em silêncio absoluto ou demonstrou total desinteresse pelas atividades e pelo grupo." value={ev.participacao} onChange={(v) => updateEval(peer.studentId, "participacao", v)} gender="masc" />
                {hasRolePenalty && (
                  <CriteriaSlider label={`Desempenho no Papel de ${roleLabels[peer.role]}`} sublabel="Penalidade (até -1)" tooltip={`Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial. | Excelente: Cumpriu todas as funções da forma esperada (ex: coordenador seguiu a pauta e gerenciou o tempo; quadro anotou os pontos principais com clareza; mesa registrou todos os dados e publicou prontamente). | Bom: Executou a maior parte das funções, mas falhou em pontos isolados. | Razoável: Tentou executar a função, mas deixou de realizar metade das tarefas. | Fraco: Realizou apenas tarefas mínimas ou superficiais, demonstrando desinteresse. | Nenhum: Não cumpriu as funções essenciais de sua responsabilidade.`} value={ev.desempenhoPapel} onChange={(v) => updateEval(peer.studentId, "desempenhoPapel", v)} penalty />
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
const SCORE_LABELS_FEM: Record<string, string> = {
  "0.00": "Nenhuma",
  "0.25": "Fraca",
  "0.50": "Razoável",
  "0.75": "Boa",
  "1.00": "Excelente",
};

const SCORE_LABELS_MASC: Record<string, string> = {
  "0.00": "Nenhum",
  "0.25": "Fraco",
  "0.50": "Razoável",
  "0.75": "Bom",
  "1.00": "Excelente",
};

function getScoreLabel(value: number, gender: "fem" | "masc" = "fem"): string {
  const labels = gender === "masc" ? SCORE_LABELS_MASC : SCORE_LABELS_FEM;
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
          {sublabel && <span className="text-xs text-muted-foreground ml-1">({sublabel})</span>}
        </div>
        <span className={`text-sm font-bold ${color}`}>{getScoreLabel(value, penalty ? "masc" : gender)}</span>
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
            <span className="text-emerald-600">Nenhum</span>
            <span className="text-lime-600">Fraco</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-orange-600">Bom</span>
            <span className="text-red-600">Excelente</span>
          </>
        ) : gender === "masc" ? (
          <>
            <span className="text-red-600">Nenhum</span>
            <span className="text-orange-500">Fraco</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-lime-600">Bom</span>
            <span className="text-emerald-600">Excelente</span>
          </>
        ) : (
          <>
            <span className="text-red-600">Nenhuma</span>
            <span className="text-orange-500">Fraca</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-lime-600">Boa</span>
            <span className="text-emerald-600">Excelente</span>
          </>
        )}
      </div>
    </div>
  );
}
