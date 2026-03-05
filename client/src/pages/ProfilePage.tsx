import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { User, Lock, Layers, Eye, EyeOff, Loader2, Shield, BookOpen, KeyRound, Mail, AlertTriangle } from "lucide-react";
import { useState, FormEvent } from "react";
import { toast } from "sonner";

function ProfileContent() {
  const { user } = useAuth();
  const { data: myComponents, isLoading: loadingComponents } = trpc.professors.myComponents.useQuery();
  const { data: passwordInfo, isLoading: loadingPasswordInfo } = trpc.auth.hasPassword.useQuery();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Set password states (for OAuth users without password)
  const [setPassPassword, setSetPassPassword] = useState("");
  const [setPassConfirm, setSetPassConfirm] = useState("");
  const [setPassEmail, setSetPassEmail] = useState("");
  const [showSetPassPassword, setShowSetPassPassword] = useState(false);
  const [isSettingPass, setIsSettingPass] = useState(false);

  const utils = trpc.useUtils();

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChanging(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsChanging(false);
    },
  });

  const setPasswordMutation = trpc.auth.setPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha definida com sucesso! Agora você pode fazer login por e-mail e senha.");
      setSetPassPassword("");
      setSetPassConfirm("");
      setSetPassEmail("");
      setIsSettingPass(false);
      utils.auth.hasPassword.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSettingPass(false);
    },
  });

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setIsChanging(true);
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSetPassword = (e: FormEvent) => {
    e.preventDefault();
    if (setPassPassword !== setPassConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (setPassPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!user?.email && !setPassEmail) {
      toast.error("Informe um e-mail para login.");
      return;
    }
    setIsSettingPass(true);
    setPasswordMutation.mutate({
      newPassword: setPassPassword,
      ...((!user?.email && setPassEmail) ? { email: setPassEmail } : {}),
    });
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "coordinator": return "Coordenador";
      case "prof": return "Professor";
      default: return "Usuário";
    }
  };

  const roleVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case "admin": return "default";
      case "coordinator": return "secondary";
      default: return "outline";
    }
  };

  const componentRoleLabel = (role: string) => {
    return role === "coordinator" ? "Coordenador" : "Professor";
  };

  if (!user) return null;

  const hasPassword = passwordInfo?.hasPassword ?? true;
  const hasEmail = passwordInfo?.hasEmail ?? true;

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">Gerencie suas informações pessoais e senha.</p>
      </div>

      {/* Informações pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <p className="font-medium">{user.name || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <p className="font-medium">{user.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Papel no Sistema</Label>
              <div className="mt-1">
                <Badge variant={roleVariant(user.role)}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabel(user.role)}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Método de Login</Label>
              <div className="mt-1">
                <Badge variant="outline">
                  <KeyRound className="h-3 w-3 mr-1" />
                  {user.loginMethod === "email" ? "E-mail/Senha" : 
                   user.loginMethod?.includes("+email") ? `${user.loginMethod.replace("+email", "")} + E-mail/Senha` :
                   user.loginMethod || "OAuth"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Componentes */}
      {user.role !== "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" />
              Meus Componentes
            </CardTitle>
            <CardDescription>Componentes curriculares dos quais você faz parte.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingComponents ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : myComponents && myComponents.length > 0 ? (
              <div className="space-y-3">
                {myComponents.map((mc: any) => (
                  <div key={mc.componentId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{mc.componentCode}</p>
                        <p className="text-xs text-muted-foreground">{mc.componentName}</p>
                      </div>
                    </div>
                    <Badge variant={mc.role === "coordinator" ? "secondary" : "outline"} className="text-xs">
                      {componentRoleLabel(mc.role)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Você ainda não faz parte de nenhum componente.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Definir Senha (for OAuth users without password) */}
      {!loadingPasswordInfo && !hasPassword && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Definir Senha
            </CardTitle>
            <CardDescription>
              Você entrou via OAuth e ainda não tem uma senha definida. Defina uma senha para ter um método de login alternativo por e-mail e senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              {!hasEmail && (
                <div className="space-y-1.5">
                  <Label htmlFor="setPassEmail" className="text-sm">
                    <Mail className="h-3.5 w-3.5 inline mr-1" />
                    E-mail para Login
                  </Label>
                  <Input
                    id="setPassEmail"
                    type="email"
                    value={setPassEmail}
                    onChange={(e) => setSetPassEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="seu@email.com"
                  />
                  <p className="text-xs text-muted-foreground">Este e-mail será usado para fazer login por e-mail/senha.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="setPassPassword" className="text-sm">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="setPassPassword"
                    type={showSetPassPassword ? "text" : "password"}
                    value={setPassPassword}
                    onChange={(e) => setSetPassPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetPassPassword(!showSetPassPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSetPassPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setPassConfirm" className="text-sm">Confirmar Senha</Label>
                <Input
                  id="setPassConfirm"
                  type="password"
                  value={setPassConfirm}
                  onChange={(e) => setSetPassConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                />
              </div>

              <Button type="submit" disabled={isSettingPass} className="w-full">
                {isSettingPass ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Definindo...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Definir Senha
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Alterar Senha (only shown if user already has a password) */}
      {!loadingPasswordInfo && hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso ao sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-sm">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Digite sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                />
              </div>

              <Button type="submit" disabled={isChanging} className="w-full">
                {isChanging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Alterar Senha"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
      <ProfileContent />
  );
}
