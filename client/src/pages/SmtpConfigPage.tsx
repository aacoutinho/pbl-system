import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, Server, Shield, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, Send } from "lucide-react";

export default function SmtpConfigPage() {
  return (
    <DashboardLayout>
      <SmtpConfigContent />
    </DashboardLayout>
  );
}

function SmtpConfigContent() {
  const { data: existingConfig, isLoading } = trpc.smtp.get.useQuery();
  const utils = trpc.useUtils();

  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("Avaliação Tutorial");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (existingConfig) {
      setHost(existingConfig.host);
      setPort(existingConfig.port);
      setSecure(existingConfig.secure);
      setUsername(existingConfig.username);
      setFromEmail(existingConfig.fromEmail);
      setFromName(existingConfig.fromName);
    }
  }, [existingConfig]);

  const saveMut = trpc.smtp.save.useMutation({
    onSuccess: () => {
      utils.smtp.get.invalidate();
      toast.success("Configuração SMTP salva com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMut = trpc.smtp.test.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Conexão SMTP testada com sucesso!");
      } else {
        toast.error("Falha na conexão: " + (data.error || "desconhecido"));
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.smtp.delete.useMutation({
    onSuccess: () => {
      utils.smtp.get.invalidate();
      setHost(""); setPort(587); setSecure(false); setUsername(""); setPassword(""); setFromEmail(""); setFromName("Avaliação Tutorial");
      toast.success("Configuração SMTP removida");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!host || !username || !password || !fromEmail || !fromName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    saveMut.mutate({ host, port, secure, username, password, fromEmail, fromName });
  };

  const handleTest = () => {
    if (!host || !username || !password) {
      toast.error("Preencha host, usuário e senha para testar");
      return;
    }
    testMut.mutate({ host, port, secure, username, password });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuração de E-mail</h1>
        <p className="text-muted-foreground">Configure o servidor SMTP para envio de e-mails de recuperação de senha.</p>
      </div>

      {existingConfig?.configured ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">SMTP configurado e ativo. E-mails de recuperação de senha estão habilitados.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">SMTP não configurado. A recuperação de senha por e-mail está desabilitada.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Servidor SMTP
          </CardTitle>
          <CardDescription>
            Informe os dados do servidor de e-mail. Para Gmail, use smtp.gmail.com com porta 587 e uma senha de aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="host">Servidor (Host)</Label>
              <Input
                id="host"
                placeholder="smtp.gmail.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                type="number"
                placeholder="587"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 587)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="secure"
              checked={secure}
              onCheckedChange={setSecure}
            />
            <Label htmlFor="secure" className="text-sm">
              Conexão segura (SSL/TLS na porta 465)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Credenciais
          </CardTitle>
          <CardDescription>
            Para Gmail, crie uma "Senha de Aplicativo" em myaccount.google.com &gt; Segurança &gt; Verificação em duas etapas &gt; Senhas de app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Usuário (e-mail)</Label>
            <Input
              id="username"
              type="email"
              placeholder="seu.email@gmail.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password">Senha / Senha de Aplicativo</Label>
            <div className="relative">
              <Input
                id="smtp-password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha do servidor SMTP"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Remetente
          </CardTitle>
          <CardDescription>
            Informações que aparecerão como remetente nos e-mails enviados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fromEmail">E-mail do remetente</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="seu.email@gmail.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fromName">Nome do remetente</Label>
              <Input
                id="fromName"
                placeholder="Avaliação Tutorial"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleTest}
          variant="outline"
          disabled={testMut.isPending || !host || !username || !password}
          className="gap-2"
        >
          {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Testar Conexão
        </Button>
        <Button
          onClick={handleSave}
          disabled={saveMut.isPending || !host || !username || !password || !fromEmail || !fromName}
          className="gap-2"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Salvar Configuração
        </Button>
        {existingConfig?.configured && (
          <Button
            onClick={() => deleteMut.mutate()}
            variant="destructive"
            disabled={deleteMut.isPending}
            className="gap-2"
          >
            Remover Configuração
          </Button>
        )}
      </div>
    </div>
  );
}
