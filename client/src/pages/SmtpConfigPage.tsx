import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, Server, Shield, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, Send, HelpCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

function GmailHelpSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-blue-800">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            Como configurar o Gmail como servidor SMTP?
          </CardTitle>
          {isOpen ? <ChevronUp className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-blue-600" />}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="text-sm text-blue-900 space-y-5">
          {/* Passo 1 */}
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Passo 1: Ativar a Verificação em Duas Etapas</h3>
            <p className="text-blue-800/80 mb-2">
              A "Senha de App" do Google requer que a verificação em duas etapas esteja ativada na sua conta.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800/80">
              <li>Acesse <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 inline-flex items-center gap-0.5">myaccount.google.com <ExternalLink className="h-3 w-3" /></a></li>
              <li>Vá em <strong>Segurança</strong></li>
              <li>Ative a <strong>Verificação em duas etapas</strong> (se ainda não estiver ativa)</li>
            </ol>
          </div>

          {/* Passo 2 */}
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Passo 2: Criar uma Senha de Aplicativo</h3>
            <ol className="list-decimal list-inside space-y-1 text-blue-800/80">
              <li>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 inline-flex items-center gap-0.5">myaccount.google.com/apppasswords <ExternalLink className="h-3 w-3" /></a></li>
              <li>Em "Nome do app", digite <strong>Sistema Avaliação</strong> (ou outro nome de sua preferência)</li>
              <li>Clique em <strong>Criar</strong></li>
              <li>O Google gerará uma senha de 16 caracteres (ex: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">abcd efgh ijkl mnop</code>)</li>
              <li>Copie essa senha — ela será usada no campo "Senha" abaixo</li>
            </ol>
          </div>

          {/* Passo 3 */}
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Passo 3: Preencher os Campos</h3>
            <div className="rounded-lg border border-blue-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100/70">
                    <th className="text-left px-3 py-2 font-semibold text-blue-800">Campo</th>
                    <th className="text-left px-3 py-2 font-semibold text-blue-800">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  <tr><td className="px-3 py-2 font-medium">Servidor (Host)</td><td className="px-3 py-2"><code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">smtp.gmail.com</code></td></tr>
                  <tr><td className="px-3 py-2 font-medium">Porta</td><td className="px-3 py-2"><code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">587</code></td></tr>
                  <tr><td className="px-3 py-2 font-medium">Conexão segura (SSL/TLS)</td><td className="px-3 py-2">Desativado (usar STARTTLS na porta 587)</td></tr>
                  <tr><td className="px-3 py-2 font-medium">Usuário</td><td className="px-3 py-2">Seu e-mail completo do Gmail</td></tr>
                  <tr><td className="px-3 py-2 font-medium">Senha</td><td className="px-3 py-2">A senha de app de 16 caracteres gerada</td></tr>
                  <tr><td className="px-3 py-2 font-medium">E-mail do remetente</td><td className="px-3 py-2">Mesmo e-mail do Gmail</td></tr>
                  <tr><td className="px-3 py-2 font-medium">Nome do remetente</td><td className="px-3 py-2">Seu nome ou "Avaliação Tutorial"</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota Google Workspace */}
          <div className="bg-blue-100/60 rounded-lg p-3">
            <p className="font-semibold text-blue-800 mb-1">E-mail institucional (Google Workspace)</p>
            <p className="text-blue-800/80">
              Se você usa um e-mail institucional via Google Workspace (ex: @uefs.br), o processo é o mesmo.
              Caso não consiga criar a senha de app, o administrador do domínio pode precisar habilitar
              essa opção nas configurações do Workspace.
            </p>
          </div>

          {/* Nota importante */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="flex items-start gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> A senha de app é diferente da sua senha normal do Gmail.
                Ela funciona exclusivamente para aplicativos de terceiros e pode ser revogada a qualquer
                momento na página de <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline hover:text-amber-900">Senhas de app</a>.
              </span>
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

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

  const [host, setHost] = useState("smtp.gmail.com");
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
      if (data.success && data.emailSent) {
        toast.success("Conexão testada com sucesso! Um e-mail de teste foi enviado para sua caixa de entrada.");
      } else if (data.success) {
        toast.success("Conexão SMTP testada com sucesso! Preencha o e-mail do remetente para receber um e-mail de teste.");
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
    testMut.mutate({ host, port, secure, username, password, fromEmail: fromEmail || undefined, fromName: fromName || undefined });
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

      <GmailHelpSection />
    </div>
  );
}
