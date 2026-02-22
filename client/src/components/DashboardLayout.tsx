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
import { useClassContext } from "@/contexts/ClassContext";
import { trpc } from "@/lib/trpc";
import { LayoutDashboard, Users, ClipboardList, BarChart3, LogOut, PanelLeft, GraduationCap, BookOpen, ClipboardCheck, Download, KeyRound, UserCheck, Clock, Eye, EyeOff, Loader2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { toast } from "sonner";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Painel Geral", path: "/" },
  { icon: BookOpen, label: "Turmas", path: "/classes" },
  { icon: Users, label: "Alunos", path: "/students" },
  { icon: ClipboardList, label: "Sessões", path: "/sessions" },
  { icon: ClipboardCheck, label: "Avaliar Tutorial", path: "/tutorial-eval" },
  { icon: BarChart3, label: "Resultados", path: "/results" },
  { icon: Download, label: "Exportar Alunos", path: "/export-students" },
  { icon: UserCheck, label: "Professores", path: "/professors" },
];

// Students access only via session code — no dashboard menu needed

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: firstUserData } = trpc.auth.isFirstUser.useQuery();
  const isFirstUser = firstUserData?.isFirstUser ?? false;

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.reload();
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, name, password });
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
            Avaliação Tutorial
          </h1>
          {isFirstUser && mode === "register" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-sm text-amber-800 font-medium">Primeiro acesso ao sistema</p>
              <p className="text-xs text-amber-600 mt-1">Crie a conta do professor administrador.</p>
            </div>
          )}
          {!isFirstUser && (
            <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
              Sistema de avaliação de Desempenho Tutorial.
            </p>
          )}
        </div>

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
          <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wider">
            {mode === "login" ? "Professor" : isFirstUser ? "Criar Administrador" : "Novo Professor"}
          </p>

          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm">Nome completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="professor@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 6 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold mt-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {mode === "login" ? "Entrar" : isFirstUser ? "Criar Conta de Administrador" : "Cadastrar"}
          </Button>
        </form>

        {!isFirstUser && (
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setIsSubmitting(false); }}
            className="text-sm text-primary hover:underline transition-colors"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
          </button>
        )}

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
          Entrar com Código da Sessão
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

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
            onClick={() => { window.location.href = "/"; }}
            variant="outline"
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Voltar
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

  const menuItems = adminMenuItems;
  const activeMenuItem = menuItems.find(item => item.path === location);

  // Class selector for admin
  const { selectedClassId, setSelectedClassId } = useClassContext();
  const { data: classesList } = trpc.classes.list.useQuery();

  // Auto-select first class if none selected
  useEffect(() => {
    if (classesList && classesList.length > 0 && selectedClassId === null) {
      setSelectedClassId(classesList[0].id);
    }
  }, [classesList, selectedClassId, setSelectedClassId]);

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

  const classOptions = (classesList ?? []).map(c => ({ id: c.id, label: `${c.componentCode} - ${c.classCode} (${c.semester})` }));

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
                    Avaliação Tutorial
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          {/* Class selector */}
          {!isCollapsed && classOptions.length > 0 && (
            <div className="px-3 pb-2">
              <Select
                value={selectedClassId ? String(selectedClassId) : ""}
                onValueChange={(v) => setSelectedClassId(parseInt(v))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a turma..." />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isCollapsed && <Separator className="mb-1" />}

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
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
                      Professor · {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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

      <SidebarInset>
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
