import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileJson, RotateCcw, Trash2, UploadCloud } from "lucide-react";
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
import { TABLE_LABELS } from "./BackupPage";

export default function RestorePage() {
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

  const importMutation = trpc.backup.import.useMutation({
    onSuccess: (result) => {
      toast.success(`Restauração concluída! ${result.tablesImported} tabelas, ${result.rowsImported} registros importados.`);
      setIsImporting(false);
      setShowConfirmImport(false);
      setShowImportDialog(false);
      setImportData(null);
      setImportFileName("");
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

  const importTableCount = importData
    ? Object.keys(importData.tables).filter((k) => importData.tables[k]?.length > 0).length
    : 0;
  const importRowCount = importData
    ? Object.values(importData.tables as Record<string, unknown[]>).reduce((sum, rows) => sum + (rows?.length ?? 0), 0)
    : 0;

  return (
    <>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-3 mb-2">
          <UploadCloud className="h-7 w-7 text-amber-600" />
          <h1 className="text-2xl font-bold">Restauração</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Restaure o banco de dados a partir de um arquivo de backup ou reconstrua a estrutura do zero.
        </p>

        {/* Import Section */}
        <Card className="border-amber-200 bg-amber-50/30 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-600" />
              Importar Backup
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
              Selecionar Arquivo JSON
            </Button>
          </CardContent>
        </Card>

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
    </>
  );
}
