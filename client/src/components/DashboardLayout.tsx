import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useIsMobile } from "@/hooks/useMobile";
import { useComponentContext } from "@/contexts/ComponentContext";
import { trpc } from "@/lib/trpc";
import { LayoutDashboard, Users, ClipboardList, BarChart3, LogOut, PanelLeft, GraduationCap, BookOpen, ClipboardCheck, Download, KeyRound, UserCheck, Clock, Eye, EyeOff, Loader2, Mail, ArrowRightLeft, Layers, User, History, Bell, MessageSquare, DatabaseBackup, Settings, ChevronDown, UploadCloud } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { toast } from "sonner";

// Common menu items for all approved users (prof, coordinator, admin)
// "Componentes" moved to Configurações submenu
const baseMenuItems = [
  { icon: LayoutDashboard, label: "Painel Geral", path: "/" },
  { icon: BookOpen, label: "Turmas", path: "/classes" },
  { icon: Users, label: "Alunos", path: "/students" },
  { icon: ClipboardList, label: "Sessões", path: "/sessions" },
  { icon: BarChart3, label: "Resultados", path: "/results" },
  { icon: UserCheck, label: "Professores", path: "/professors" },
];

// Tutorial evaluation: for prof, coordinator, and admin
const tutorialEvalItem = { icon: ClipboardCheck, label: "Avaliar Tutorial", path: "/tutorial-eval" };

// Notifications: for all approved users
const notificationsItem = { icon: Bell, label: "Notificações", path: "/notifications" };

// Contact: for all approved users
const contactItem = { icon: MessageSquare, label: "Contato", path: "/contact" };

// Admin-only config sub-items (grouped under "Configurações")
const configSubItemsAdmin = [
  { icon: Layers, label: "Componentes", path: "/components" },
  { icon: Mail, label: "E-mails", path: "/smtp-config" },
  { icon: DatabaseBackup, label: "Backup", path: "/backup" },
  { icon: UploadCloud, label: "Restauração", path: "/restauracao" },
  { icon: Download, label: "Exportar", path: "/export-students" },
  { icon: History, label: "Histórico", path: "/audit-log" },
];

// Non-admin config sub-items (no admin-only items)
const configSubItemsUser = [
  { icon: Download, label: "Exportar", path: "/export-students" },
];

const configGroupItemAdmin = { icon: Settings, label: "Configurações", path: "__config__", subItems: configSubItemsAdmin };
const configGroupItemUser = { icon: Settings, label: "Configurações", path: "__config__", subItems: configSubItemsUser };

function getMenuItemsForRole(role: string) {
  if (role === "admin") {
    const items = [...baseMenuItems];
    const sessionsIdx = items.findIndex(i => i.path === "/sessions");
    items.splice(sessionsIdx + 1, 0, tutorialEvalItem);
    items.push(notificationsItem, contactItem, configGroupItemAdmin);
    return items;
  }
  // coordinator and prof: include tutorial eval
  const items = [...baseMenuItems];
  // Insert tutorial eval after Sessões
  const sessionsIdx = items.findIndex(i => i.path === "/sessions");
  items.splice(sessionsIdx + 1, 0, tutorialEvalItem);
  // All approved users get notifications and contact
  items.push(notificationsItem);
  items.push(contactItem);
  items.push(configGroupItemUser);
  return items;
}

// Students access only via session code — no dashboard menu needed

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot" | "code" | "newpass">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedComponentIds, setSelectedComponentIds] = useState<number[]>([]);
  const [verificationCode, setVerificationCode] = useState("");

  const { data: firstUserData } = trpc.auth.isFirstUser.useQuery();
  const { data: componentsList } = trpc.components.listPublic.useQuery();
  const isFirstUser = firstUserData?.isFirstUser ?? false;
  const { data: smtpStatus } = trpc.auth.smtpStatus.useQuery();
  const smtpConfigured = smtpStatus?.configured ?? false;

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSubmitting(false);
    },
  });

  const sendVerificationCodeMutation = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: (data) => {
      if (data.smtpSkipped) {
        // First user, SMTP not configured - register directly without code
        registerMutation.mutate({ email, name, password, componentIds: [] });
      } else {
        toast.success("Código de verificação enviado para seu e-mail!");
        setMode("verify");
        setIsSubmitting(false);
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSubmitting(false);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      if (data.isFirstUser) {
        toast.success("Conta de administrador criada com sucesso!");
      } else {
        toast.success("Cadastro realizado! Aguarde a aprovação de um professor.");
      }
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSubmitting(false);
    },
  });

  const requestResetMutation = trpc.auth.requestResetCode.useMutation({
    onSuccess: () => {
      toast.success("Código enviado para seu e-mail!");
      setMode("code");
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSubmitting(false);
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso! Faça login.");
      setMode("login");
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else if (mode === "register") {
      // Step 1: Send verification code
      sendVerificationCodeMutation.mutate({ email });
    } else if (mode === "verify") {
      // Step 2: Confirm code and complete registration
      registerMutation.mutate({ email, name, password, verificationCode, componentIds: isFirstUser ? [] : selectedComponentIds });
    } else if (mode === "forgot") {
      requestResetMutation.mutate({ email });
    } else if (mode === "code" || mode === "newpass") {
      resetPasswordMutation.mutate({ email, code: resetCode, newPassword });
    }
  };

  // Auto-switch to register if first user
  useEffect(() => {
    if (isFirstUser) setMode("register");
  }, [isFirstUser]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full bg-card rounded-2xl shadow-lg border">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center text-card-foreground">
            Sessão Tutorial
          </h1>
          {isFirstUser && mode === "register" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-sm text-amber-800 font-medium">Primeiro acesso ao sistema</p>
              <p className="text-xs text-amber-600 mt-1">Crie a conta do professor administrador.</p>
            </div>
          )}
          {!isFirstUser && (
            <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
              Sistema de gestão de sessões tutoriais.
            </p>
          )}
        </div>

        {/* Student Access - First */}
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">aluno</span>
          </div>
        </div>
        <Button
          onClick={() => { window.location.href = "/acesso"; }}
          size="lg"
          variant="outline"
          className="w-full shadow-md hover:shadow-lg transition-all font-semibold gap-2"
        >
          <KeyRound className="h-5 w-5" />
          Acesso do Aluno (Matrícula)
        </Button>

        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">professor</span>
          </div>
        </div>

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          {(mode !== "login") && (
            <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wider">
              {mode === "register" ? (isFirstUser ? "Criar Administrador" : "Novo Professor") : mode === "verify" ? "Verificar E-mail" : "Recuperar Senha"}
            </p>
          )}

          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Nome completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-10"
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>
          )}

          {mode === "verify" && (
            <div className="space-y-1.5">
              <Label htmlFor="verificationCode" className="text-xs font-medium">Código de verificação</Label>
              <Input
                id="verificationCode"
                type="text"
                placeholder="Digite o código recebido por e-mail"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                required
                className="h-10"
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "verify" || mode === "newpass") && (
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">
                {mode === "newpass" ? "Nova senha" : "Senha"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "newpass" ? "Nova senha" : "Sua senha"}
                  value={mode === "newpass" ? newPassword : password}
                  onChange={e => mode === "newpass" ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "code" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="resetCode" className="text-xs font-medium">Código de recuperação</Label>
                <Input
                  id="resetCode"
                  type="text"
                  placeholder="Código recebido por e-mail"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-medium">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
            </>
          )}

          {/* Component selection for registration */}
          {mode === "verify" && !isFirstUser && componentsList && componentsList.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Componentes de interesse</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-muted/30">
                {componentsList.map(comp => (
                  <label key={comp.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedComponentIds.includes(comp.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedComponentIds(prev => [...prev, comp.id]);
                        } else {
                          setSelectedComponentIds(prev => prev.filter(id => id !== comp.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-xs">{comp.code} - {comp.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-10 font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? "Entrar" : mode === "register" ? "Continuar" : mode === "verify" ? "Verificar e Cadastrar" : mode === "forgot" ? "Enviar código" : "Redefinir senha"}
          </Button>

          <div className="flex flex-col gap-1 items-center">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => { setMode("register"); setPassword(""); }}
                  className="text-xs text-primary hover:underline"
                >
                  Criar conta de professor
                </button>
                {smtpConfigured && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </>
            )}
            {(mode !== "login") && (
              <button
                type="button"
                onClick={() => { setMode("login"); setPassword(""); setResetCode(""); setNewPassword(""); setVerificationCode(""); }}
                className="text-xs text-muted-foreground hover:underline"
              >
                Voltar ao login
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  // Keep sidebar open on desktop — controlled state persists across route changes
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { loading, user, logout } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  // Check if user is pending approval
  if (user && user.approvalStatus !== "approved") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="flex flex-col items-center gap-6 p-10 max-w-md w-full bg-card rounded-2xl shadow-lg border">
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-center text-card-foreground">
            Acesso Pendente
          </h1>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Olá, <strong>{user.name || user.email}</strong>! Seu cadastro foi recebido e está aguardando aprovação de um professor já autorizado.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {user.approvalStatus === "rejected" 
              ? "Sua solicitação foi rejeitada. Entre em contato com o administrador."
              : "Você será notificado quando seu acesso for liberado. Tente novamente mais tarde."}
          </p>
          <Button
            onClick={async () => { await logout(); window.location.href = "/"; }}
            variant="outline"
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin";
  const menuItems = getMenuItemsForRole(user?.role || "prof");
  const allConfigSubItems = isAdmin ? configSubItemsAdmin : configSubItemsUser;
  const [configOpen, setConfigOpen] = useState(() => {
    // Auto-open if current location is a config sub-item
    return allConfigSubItems.some(si => si.path === window.location.pathname);
  });
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unreadCount = unreadData?.count ?? 0;

  // SMTP status indicator for admin menu
  const { data: smtpStatusData } = trpc.auth.smtpStatus.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });
  const smtpConfigured = smtpStatusData?.configured ?? true; // default true to avoid flash

  // Open contact tickets count for admin
  const { data: openTicketsData } = trpc.contactTickets.openCount.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 60000,
  });
  const openTicketsCount = openTicketsData?.count ?? 0;
  const activeMenuItem = menuItems.find(item => item.path === location) 
    || allConfigSubItems.find(item => item.path === location);

  // ── Global Filters ──────────────────────────────────────────────────────────
  const {
    selectedComponentId, setSelectedComponentId, setSelectedComponentMeta,
    selectedSemester, setSelectedSemester,
    selectedClassId, selectedClassCode, setSelectedClass,
    selectedProblemNumber, setSelectedProblem,
    selectedSessionId, selectedSessionNumber, setSelectedSession,
  } = useComponentContext();

  // Component list
  const { data: componentsList } = trpc.components.listMine.useQuery();

  // Semester list (depends on component)
  const { data: semestersList } = trpc.classes.semestersByComponent.useQuery(
    { componentId: selectedComponentId! },
    { enabled: !!selectedComponentId }
  );

  // Class list (depends on component + semester)
  const { data: classesList } = trpc.classes.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );

  // Session list (depends on component + semester + class)
  const { data: sessionsList } = trpc.sessions.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined, classId: selectedClassId ?? undefined },
    { enabled: !!selectedComponentId }
  );

  // Derive unique problem numbers from sessions
  const problemNumbers = useMemo(() => {
    if (!sessionsList) return [];
    const pSet = new Set(sessionsList.map((s: any) => s.problemNumber as number));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [sessionsList]);

  // Sessions for selected problem
  const sessionsForProblem = useMemo(() => {
    if (!sessionsList || selectedProblemNumber === null) return [];
    return sessionsList.filter((s: any) => s.problemNumber === selectedProblemNumber);
  }, [sessionsList, selectedProblemNumber]);

  // Auto-select first component if none selected or invalid
  useEffect(() => {
    if (!componentsList) return;
    if (componentsList.length === 0) {
      if (selectedComponentId !== null) setSelectedComponentId(null);
      setSelectedComponentMeta(null, null);
      return;
    }
    if (selectedComponentId !== null && !componentsList.some(c => c.id === selectedComponentId)) {
      const first = componentsList[0];
      setSelectedComponentId(first.id);
      setSelectedComponentMeta(first.code, first.name ?? null);
      return;
    }
    if (selectedComponentId === null) {
      const first = componentsList[0];
      setSelectedComponentId(first.id);
      setSelectedComponentMeta(first.code, first.name ?? null);
    } else {
      const found = componentsList.find(c => c.id === selectedComponentId);
      if (found) setSelectedComponentMeta(found.code, found.name ?? null);
    }
  }, [componentsList, selectedComponentId]);

  // Auto-select latest semester when list loads
  useEffect(() => {
    if (!semestersList || semestersList.length === 0) return;
    if (!selectedSemester || !semestersList.includes(selectedSemester)) {
      setSelectedSemester(semestersList[0]); // semestersList is ordered desc
    }
  }, [semestersList]);

  // Auto-select professor's class (or first) when class list loads
  useEffect(() => {
    if (!classesList || classesList.length === 0) return;
    if (selectedClassId !== null && classesList.some((c: any) => c.id === selectedClassId)) return;
    const profClass = classesList.find((c: any) => c.professorUserId === user?.id);
    const target = profClass ?? classesList[0];
    setSelectedClass(target.id, target.classCode);
  }, [classesList]);

  // Auto-select last problem when problem list changes
  useEffect(() => {
    if (problemNumbers.length === 0) return;
    if (selectedProblemNumber !== null && problemNumbers.includes(selectedProblemNumber)) return;
    setSelectedProblem(problemNumbers[problemNumbers.length - 1]);
  }, [problemNumbers]);

  // Auto-select last session for selected problem
  useEffect(() => {
    if (sessionsForProblem.length === 0) return;
    if (selectedSessionId !== null && sessionsForProblem.some((s: any) => s.id === selectedSessionId)) return;
    const last = sessionsForProblem[sessionsForProblem.length - 1];
    setSelectedSession(last.id, last.sessionNumber);
  }, [sessionsForProblem]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const componentOptions = (componentsList ?? [])
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(c => ({ id: c.id, label: c.code, fullLabel: c.name ? `${c.code} - ${c.name}` : c.code }));
  const selectedComponent = componentOptions.find(c => c.id === selectedComponentId) ?? null;

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate text-sm">
                    Sessão Tutorial
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          {/* Global Filters */}
          {!isCollapsed && (
            <div className="px-2 pb-1.5">
              <div className="border rounded-md overflow-hidden bg-white">

                {/* Linha 1: Componente + Semestre */}
                <div className="grid grid-cols-2 divide-x border-b">
                  {/* Componente */}
                  <div className="px-1 py-0.5">
                    <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0">Componente</p>
                    <Select
                      value={selectedComponentId ? String(selectedComponentId) : ""}
                      onValueChange={(v) => {
                        const id = parseInt(v);
                        setSelectedComponentId(id);
                        const found = (componentsList ?? []).find(c => c.id === id);
                        if (found) setSelectedComponentMeta(found.code, found.name ?? null);
                      }}
                    >
                      <SelectTrigger className="h-4 w-full text-[9px] font-semibold px-0.5 justify-start gap-0 border-0 shadow-none focus:ring-0 bg-transparent">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentOptions.length === 0 ? (
                          <SelectItem value="__none" disabled className="text-xs text-muted-foreground">Nenhum</SelectItem>
                        ) : componentOptions.map(c => (
                          <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                            <span className="font-semibold">{c.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Semestre */}
                  <div className="px-1 py-0.5">
                    <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0">Semestre</p>
                    <Select
                      value={selectedSemester ?? ""}
                      onValueChange={(v) => setSelectedSemester(v)}
                    >
                      <SelectTrigger className="h-4 w-full text-[9px] font-semibold px-0.5 justify-start gap-0 border-0 shadow-none focus:ring-0 bg-transparent">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {(!semestersList || semestersList.length === 0) ? (
                          <SelectItem value="__none" disabled className="text-xs text-muted-foreground">Nenhum</SelectItem>
                        ) : semestersList.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">
                            <span className="font-semibold">{s}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha 2: Turma + Problema + Sessão */}
                <div className="grid grid-cols-3 divide-x">
                  {/* Turma */}
                  <div className="px-1 py-0.5">
                    <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0">Turma</p>
                    <Select
                      value={selectedClassId ? String(selectedClassId) : ""}
                      onValueChange={(v) => {
                        const id = parseInt(v);
                        const found = (classesList ?? []).find((c: any) => c.id === id);
                        setSelectedClass(id, found?.classCode ?? null);
                      }}
                    >
                      <SelectTrigger className="h-4 w-full text-[9px] font-semibold px-0.5 justify-start gap-0 border-0 shadow-none focus:ring-0 bg-transparent">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {(!classesList || classesList.length === 0) ? (
                          <SelectItem value="__none" disabled className="text-xs text-muted-foreground">Nenhuma</SelectItem>
                        ) : (classesList ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                            <span className="font-semibold">{c.classCode}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Problema */}
                  <div className="px-1 py-0.5">
                    <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0">Problema</p>
                    <Select
                      value={selectedProblemNumber !== null ? String(selectedProblemNumber) : ""}
                      onValueChange={(v) => setSelectedProblem(parseInt(v))}
                    >
                      <SelectTrigger className="h-4 w-full text-[9px] font-semibold px-0.5 justify-start gap-0 border-0 shadow-none focus:ring-0 bg-transparent">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {problemNumbers.length === 0 ? (
                          <SelectItem value="__none" disabled className="text-xs text-muted-foreground">Nenhum</SelectItem>
                        ) : problemNumbers.map(p => (
                          <SelectItem key={p} value={String(p)} className="text-xs">
                            <span className="font-semibold">P{p}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sessão */}
                  <div className="px-1 py-0.5">
                    <p className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0">Sessão</p>
                    <Select
                      value={selectedSessionId !== null ? String(selectedSessionId) : ""}
                      onValueChange={(v) => {
                        const id = parseInt(v);
                        const found = sessionsForProblem.find((s: any) => s.id === id);
                        setSelectedSession(id, found?.sessionNumber ?? null);
                      }}
                    >
                      <SelectTrigger className="h-4 w-full text-[9px] font-semibold px-0.5 justify-start gap-0 border-0 shadow-none focus:ring-0 bg-transparent">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionsForProblem.length === 0 ? (
                          <SelectItem value="__none" disabled className="text-xs text-muted-foreground">Nenhuma</SelectItem>
                        ) : sessionsForProblem.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                            <span className="font-semibold">S{s.sessionNumber}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              </div>
            </div>
          )}

          {!isCollapsed && <div className="mb-1" />}

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const hasSubItems = 'subItems' in item && (item as any).subItems;
                const isNotifications = item.path === "/notifications";
                const isContact = item.path === "/contact";
                const showContactBadge = isContact && isAdmin && openTicketsCount > 0;

                if (hasSubItems) {
                  const subItems = (item as any).subItems as typeof configSubItemsAdmin;
                  const isAnySubActive = subItems.some(si => si.path === location);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isAnySubActive}
                        onClick={() => setConfigOpen(prev => !prev)}
                        tooltip={item.label}
                        className="h-10 transition-all font-normal"
                      >
                        <item.icon className={`h-4 w-4 ${isAnySubActive ? "text-primary" : ""}`} />
                        <span className="flex-1">{item.label}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${configOpen ? "rotate-0" : "-rotate-90"}`} />
                      </SidebarMenuButton>
                      {configOpen && (
                        <div className="ml-3 border-l border-border/50 pl-2 mt-0.5 mb-0.5">
                          {subItems.map(sub => {
                            const isSubActive = location === sub.path;
                            const isSmtpItem = sub.path === "/smtp-config";
                            const showSmtpWarning = isSmtpItem && !smtpConfigured;
                            return (
                              <SidebarMenuButton
                                key={sub.path}
                                isActive={isSubActive}
                                onClick={() => setLocation(sub.path)}
                                tooltip={showSmtpWarning ? `${sub.label} (configuração pendente)` : sub.label}
                                className="h-9 transition-all font-normal text-sm"
                              >
                                <div className="relative">
                                  <sub.icon className={`h-3.5 w-3.5 ${isSubActive ? "text-primary" : "text-muted-foreground"}`} />
                                  {showSmtpWarning && (
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                  )}
                                </div>
                                <span className="flex-1">{sub.label}</span>
                                {showSmtpWarning && (
                                  <span className="flex h-2 w-2 rounded-full bg-red-500 shrink-0" title="Configuração de e-mail pendente"></span>
                                )}
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                }

                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <div className="relative">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        {isNotifications && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                        {showContactBadge && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        )}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {isNotifications && unreadCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                      {showContactBadge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white" title={`${openTicketsCount} ticket(s) pendente(s)`}>
                          {openTicketsCount > 99 ? "99+" : openTicketsCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.role === "admin" ? "Administrador" : user?.role === "coordinator" ? "Coordenador" : user?.role === "prof" ? "Professor" : "Usuário"} · {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => window.location.href = "/profile"}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="h-svh overflow-y-auto">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
