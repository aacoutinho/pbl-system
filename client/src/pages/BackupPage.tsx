import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DatabaseBackup, Download, Loader2, HardDrive, Table2, Info } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  users: "Usuários",
  components: "Componentes",
  professorComponents: "Vínculos Professor-Componente",
  classes: "Turmas",
  students: "Alunos",
  classStudents: "Vínculos Aluno-Turma",
  sessions: "Sessões",
  sessionStudents: "Alunos nas Sessões",
  evaluations: "Avaliações",
  evaluationItems: "Itens de Avaliação",
  tutorialEvaluations: "Avaliações Tutoriais",
  tutorialEvalDrafts: "Rascunhos de Avaliação Tutorial",
  classEvalPermissions: "Permissões de Avaliação",
  emailVerificationCodes: "Códigos de Verificação de E-mail",
  passwordResetCodes: "Códigos de Recuperação de Senha",
  smtpConfig: "Configuração SMTP",
  auditLogs: "Histórico de Ações",
  notifications: "Notificações",
  contactTickets: "Tickets de Contato",
  professorStudentNotes: "Notas do Professor por Aluno",
  sessionAccessTokens: "Tokens de Acesso por Sessão",
  brainstormBoards: "Quadros de Brainstorming",
  brainstormItems: "Itens de Brainstorming",
  brainstormItemAttachments: "Anexos de Brainstorming",
  brainstormBoardSendHistory: "Histórico de Envio de Brainstorming",
};

export { TABLE_LABELS };

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);

  const statsQuery = trpc.backup.stats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const exportMutation = trpc.backup.export.useMutation({
    onSuccess: (data) => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `backup-avaliacao-tutorial-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup exportado com sucesso!");
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error(`Erro ao exportar: ${error.message}`);
      setIsExporting(false);
    },
  });

  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate();
  };

  const totalRows = statsQuery.data
    ? Object.values(statsQuery.data).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-3 mb-2">
          <DatabaseBackup className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold">Backup</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Visualize o estado atual do banco de dados e exporte um backup completo em formato JSON.
        </p>

        {/* Current Database Stats */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-slate-500" />
              Estado Atual do Banco de Dados
            </CardTitle>
            <CardDescription>
              Resumo dos registros armazenados em cada tabela.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando estatísticas...</span>
              </div>
            ) : statsQuery.data ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {Object.entries(statsQuery.data).map(([table, count]) => (
                    <div
                      key={table}
                      className="flex flex-col items-center justify-center rounded-lg border p-3 bg-slate-50"
                    >
                      <span className="text-xs text-muted-foreground text-center leading-tight mb-1">
                        {TABLE_LABELS[table] || table}
                      </span>
                      <span className="text-lg font-bold text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Table2 className="h-4 w-4" />
                  <span>
                    Total: <strong className="text-slate-700">{totalRows}</strong> registros em{" "}
                    <strong className="text-slate-700">{Object.keys(statsQuery.data).length}</strong> tabelas
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Não foi possível carregar as estatísticas.</p>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Gera um arquivo JSON com todos os dados do sistema. O arquivo pode ser usado para restaurar o estado do banco posteriormente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                O backup inclui todas as 25 tabelas do sistema: usuários, componentes, turmas, alunos, sessões, avaliações (incluindo rascunhos e notas do professor), permissões, códigos de verificação, notificações, configurações, quadros de brainstorming (incluindo anexos e histórico de envio) e tickets de contato.
              </p>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar JSON
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
  );
}
