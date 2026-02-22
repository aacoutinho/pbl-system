import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DatabaseBackup, Download, Upload, AlertTriangle, CheckCircle2, Loader2, FileJson, HardDrive, Table2, Info, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  classEvalPermissions: "Permissões de Avaliação",
  smtpConfig: "Configuração SMTP",
  auditLogs: "Histórico de Ações",
  notifications: "Notificações",
  contactTickets: "Tickets de Contato",
};

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importFileName, setImportFileName] = useState("");
  const [clearFirst, setClearFirst] = useState(true);
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [showRebuildDialog, setShowRebuildDialog] = useState(false);
  const [rebuildConfirmText, setRebuildConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statsQuery = trpc.backup.stats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const exportMutation = trpc.backup.export.useMutation({
    onSuccess: (data) => {
      // Download as JSON file
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

  const importMutation = trpc.backup.import.useMutation({
    onSuccess: (result) => {
      toast.success(`Restauração concluída! ${result.tablesImported} tabelas, ${result.rowsImported} registros importados.`);
      setIsImporting(false);
      setShowConfirmImport(false);
      setShowImportDialog(false);
      setImportData(null);
      setImportFileName("");
      statsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error.message}`);
      setIsImporting(false);
    },
  });

  const rebuildMutation = trpc.backup.rebuild.useMutation({
    onSuccess: (result) => {
      toast.success(`Banco reconstruído com sucesso! ${result.tablesCreated} tabelas criadas.`);
      setIsRebuilding(false);
      setShowRebuildDialog(false);
      setRebuildConfirmText("");
      statsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao reconstruir: ${error.message}`);
      setIsRebuilding(false);
    },
  });

  const confirmRebuild = () => {
    setIsRebuilding(true);
    rebuildMutation.mutate();
  };

  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.exportedAt || !data.tables) {
          toast.error("Arquivo de backup inválido. Verifique se é um backup gerado por este sistema.");
          return;
        }
        setImportData(data);
        setImportFileName(file.name);
        setShowImportDialog(true);
      } catch {
        toast.error("Erro ao ler o arquivo JSON. Verifique se o arquivo não está corrompido.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleImport = () => {
    setShowConfirmImport(true);
  };

  const confirmImport = () => {
    setIsImporting(true);
    importMutation.mutate({
      data: importData,
      clearFirst,
    });
  };

  const totalRows = statsQuery.data
    ? Object.values(statsQuery.data).reduce((sum, count) => sum + count, 0)
    : 0;

  const importTableCount = importData
    ? Object.keys(importData.tables).filter((k) => importData.tables[k]?.length > 0).length
    : 0;
  const importRowCount = importData
    ? Object.values(importData.tables as Record<string, unknown[]>).reduce((sum, rows) => sum + (rows?.length ?? 0), 0)
    : 0;

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-3 mb-2">
          <DatabaseBackup className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold">Backup / Restaurar</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Exporte o estado completo do banco de dados para backup ou restaure a partir de um arquivo de backup anterior.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                  O backup inclui todas as tabelas do sistema: usuários, componentes, turmas, alunos, sessões, avaliações, permissões, notificações e configurações. Códigos de verificação e reset de senha são excluídos por segurança.
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

          {/* Import Section */}
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-amber-600" />
                Restaurar Backup
              </CardTitle>
              <CardDescription>
                Carregue um arquivo JSON de backup para restaurar o estado do banco de dados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>Atenção:</strong> A restauração pode substituir todos os dados atuais do sistema. Recomenda-se exportar um backup antes de restaurar.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar JSON
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Rebuild Section */}
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Reconstruir Banco de Dados
            </CardTitle>
            <CardDescription>
              Apaga completamente todas as tabelas e dados, e recria a estrutura do banco do zero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <Trash2 className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                <strong>Operação destrutiva:</strong> Esta ação remove TODOS os dados e tabelas do banco de dados e recria a estrutura vazia. Use apenas se o banco estiver danificado, corrompido ou se desejar zerar completamente o sistema. Recomenda-se fortemente exportar um backup antes.
              </p>
            </div>
            <Button
              onClick={() => setShowRebuildDialog(true)}
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-100"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reconstruir Banco de Dados
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rebuild Confirmation Dialog */}
      <Dialog open={showRebuildDialog} onOpenChange={(open) => {
        if (!isRebuilding) {
          setShowRebuildDialog(open);
          if (!open) setRebuildConfirmText("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Reconstruir Banco de Dados
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível e apagará todos os dados do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <Trash2 className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">O que será feito:</p>
                <ul className="mt-1 space-y-1 text-xs text-red-700">
                  <li>1. Todas as tabelas existentes serão removidas</li>
                  <li>2. Todos os dados serão permanentemente apagados</li>
                  <li>3. As tabelas serão recriadas vazias a partir do schema</li>
                  <li>4. O sistema ficará completamente zerado</li>
                </ul>
              </div>
            </div>

            <div>
              <Label htmlFor="rebuild-confirm" className="text-sm font-medium">
                Digite <strong className="text-red-700">RECONSTRUIR</strong> para confirmar:
              </Label>
              <input
                id="rebuild-confirm"
                type="text"
                value={rebuildConfirmText}
                onChange={(e) => setRebuildConfirmText(e.target.value)}
                placeholder="RECONSTRUIR"
                className="mt-2 w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isRebuilding}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => { setShowRebuildDialog(false); setRebuildConfirmText(""); }}
              disabled={isRebuilding}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmRebuild}
              disabled={isRebuilding || rebuildConfirmText !== "RECONSTRUIR"}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {isRebuilding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Reconstruindo...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Confirmar Reconstrução
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!isImporting) {
          setShowImportDialog(open);
          if (!open) {
            setImportData(null);
            setImportFileName("");
            setShowConfirmImport(false);
          }
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-amber-600" />
              Pré-visualização do Backup
            </DialogTitle>
            <DialogDescription>
              Revise os dados do backup antes de restaurar.
            </DialogDescription>
          </DialogHeader>

          {importData && (
            <div className="space-y-4">
              {/* File info */}
              <div className="rounded-lg border p-3 bg-slate-50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Arquivo:</span>
                    <p className="font-medium truncate">{importFileName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Versão:</span>
                    <p className="font-medium">{importData.version}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exportado em:</span>
                    <p className="font-medium">
                      {new Date(importData.exportedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-medium">{importRowCount} registros em {importTableCount} tabelas</p>
                  </div>
                </div>
              </div>

              {/* Table breakdown */}
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Tabela</th>
                      <th className="text-right p-2 font-medium">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(importData.tables as Record<string, unknown[]>).map(([table, rows]) => (
                      <tr key={table} className="border-t">
                        <td className="p-2 text-muted-foreground">{TABLE_LABELS[table] || table}</td>
                        <td className="p-2 text-right font-medium">{rows?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* Clear option */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="clear-first" className="text-sm font-medium">
                    Limpar banco antes de importar
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {clearFirst
                      ? "Todos os dados atuais serão apagados antes da importação."
                      : "Os dados serão adicionados aos existentes (pode causar conflitos)."}
                  </p>
                </div>
                <Switch
                  id="clear-first"
                  checked={clearFirst}
                  onCheckedChange={setClearFirst}
                  disabled={isImporting}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!showConfirmImport ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                  disabled={isImporting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Restaurar Backup
                </Button>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Tem certeza que deseja restaurar este backup?
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {clearFirst
                        ? "Todos os dados atuais serão PERMANENTEMENTE apagados e substituídos pelos dados do backup."
                        : "Os dados do backup serão adicionados ao banco atual. Registros duplicados podem causar erros."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmImport(false)}
                    disabled={isImporting}
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={confirmImport}
                    disabled={isImporting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Restaurando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Restauração
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
