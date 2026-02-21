import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users, BookOpen, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsPage() {
  return (
    <DashboardLayout>
      <StudentsContent />
    </DashboardLayout>
  );
}

function StudentsContent() {
  const utils = trpc.useUtils();
  const { selectedClassId } = useClassContext();

  const { data: studentsList, isLoading } = trpc.students.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno cadastrado com sucesso"); },
    onError: (e) => toast.error(e.message),
  });
  const bulkMutation = trpc.students.bulkCreate.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Alunos importados com sucesso"); },
    onError: (e) => toast.error(e.message),
  });
  const importCSVMutation = trpc.students.importCSV.useMutation({
    onSuccess: (data) => {
      utils.students.list.invalidate();
      toast.success(`${data.count} alunos importados com sucesso`);
      setShowCSVImport(false);
      setCsvPreview(null);
      setCsvContent("");
      setEmailDomain("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno removido"); },
    onError: (e) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [csvPreview, setCsvPreview] = useState<{ name: string; enrollment: string; email: string }[] | null>(null);
  const [emailDomain, setEmailDomain] = useState("ecomp.uefs.br");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione uma Turma</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione uma turma no menu lateral para gerenciar seus alunos.
        </p>
      </div>
    );
  }

  const handleAdd = () => {
    if (!newName.trim() || !newEmail.trim()) { toast.error("Preencha nome e e-mail"); return; }
    createMutation.mutate({ classId: selectedClassId, name: newName.trim(), email: newEmail.trim().toLowerCase() });
    setNewName(""); setNewEmail(""); setShowAdd(false);
  };

  const handleBulk = () => {
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[,;\t]+/).map(s => s.trim());
      if (parts.length >= 2) return { name: parts[0], email: parts[1].toLowerCase() };
      return null;
    }).filter(Boolean) as { name: string; email: string }[];
    if (parsed.length === 0) { toast.error("Nenhum aluno válido encontrado. Use formato: Nome, email"); return; }
    bulkMutation.mutate({ classId: selectedClassId, students: parsed });
    setBulkText(""); setShowBulk(false);
  };

  const parseCSVPreview = useCallback((content: string, domain: string) => {
    const lines = content.split("\n");
    const parsed: { name: string; enrollment: string; email: string }[] = [];
    for (const line of lines) {
      const cols = line.split(";");
      const num = cols[1]?.trim();
      if (!num || isNaN(parseInt(num))) continue;
      const enrollment = cols[3]?.trim();
      const name = cols[4]?.trim();
      if (!name || !enrollment) continue;
      if (name === "Aluno" || enrollment === "Matrícula") continue;

      // Generate email: initials + last name (ignoring suffixes like Junior, Jr., Neto, Filho)
      const emailDomain = domain || "ecomp.uefs.br";
      const parts = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter(p => p.length > 0);
      
      // Remove common suffixes from the end
      const suffixes = ["junior", "jr", "jr.", "neto", "filho"];
      let filteredParts = [...parts];
      while (filteredParts.length > 1 && suffixes.includes(filteredParts[filteredParts.length - 1].replace(/\./g, ""))) {
        filteredParts.pop();
      }
      
      let email = "";
      if (filteredParts.length >= 2) {
        const initials = filteredParts.slice(0, -1).map(p => p[0]).join("");
        const lastName = filteredParts[filteredParts.length - 1];
        email = `${initials}${lastName}@${emailDomain}`;
      } else {
        email = `${filteredParts[0]}@${emailDomain}`;
      }
      parsed.push({ name, enrollment, email });
    }
    return parsed;
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Try reading with different encodings
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      const preview = parseCSVPreview(text, emailDomain);
      setCsvPreview(preview);
      if (preview.length === 0) {
        toast.error("Nenhum aluno encontrado no arquivo. Verifique se é uma Folha de Frequência do SAGRES.");
      } else {
        toast.success(`${preview.length} alunos encontrados no arquivo`);
      }
    };
    // Try ISO-8859-1 first (common for SAGRES)
    reader.readAsText(file, "ISO-8859-1");
  };

  const handleDomainChange = (newDomain: string) => {
    setEmailDomain(newDomain);
    if (csvContent) {
      setCsvPreview(parseCSVPreview(csvContent, newDomain));
    }
  };

  const handleCSVImport = () => {
    if (!csvContent) { toast.error("Selecione um arquivo CSV"); return; }
    importCSVMutation.mutate({
      classId: selectedClassId,
      csvContent,
      emailDomain: emailDomain || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os alunos da turma selecionada.</p>
        </div>
        <div className="flex gap-2">
          {/* CSV Import from SAGRES */}
          <Dialog open={showCSVImport} onOpenChange={(open) => {
            setShowCSVImport(open);
            if (!open) { setCsvPreview(null); setCsvContent(""); setEmailDomain(""); }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar Alunos via CSV (SAGRES)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Arquivo CSV (Folha de Frequência do SAGRES)</Label>
                  <div className="mt-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      className="w-full h-20 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para selecionar o arquivo CSV
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Domínio de e-mail (opcional)</Label>
                  <Input
                    value={emailDomain}
                    onChange={e => handleDomainChange(e.target.value)}
                    placeholder="ecomp.uefs.br"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se não informado, os e-mails serão gerados automaticamente no formato <strong>letras_iniciais+ultimo_nome@ecomp.uefs.br</strong>.
                    Sufixos como Junior, Jr., Neto e Filho são ignorados.
                  </p>
                </div>

                {csvPreview && csvPreview.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Pré-visualização ({csvPreview.length} alunos)
                    </Label>
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">#</th>
                              <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                              <th className="px-3 py-2 text-left font-medium">Nome</th>
                              <th className="px-3 py-2 text-left font-medium">E-mail (gerado)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((s, i) => (
                              <tr key={i} className="border-t hover:bg-accent/20">
                                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-2 font-mono text-xs">{s.enrollment}</td>
                                <td className="px-3 py-2">{s.name}</td>
                                <td className="px-3 py-2 text-xs">
                                  {s.email.includes("placeholder") ? (
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />{s.email}
                                    </span>
                                  ) : s.email}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {csvPreview.some(s => s.email.includes("placeholder")) && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        E-mails com "placeholder" precisarão ser editados manualmente após a importação.
                        Informe um domínio de e-mail acima para gerar automaticamente.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCSVImport}
                  disabled={importCSVMutation.isPending || !csvPreview || csvPreview.length === 0}
                >
                  {importCSVMutation.isPending ? "Importando..." : `Importar ${csvPreview?.length ?? 0} Alunos`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk text import */}
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />Importar Texto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Alunos em Lote</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Lista de alunos (um por linha: Nome, email)</Label>
                  <Textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"João Silva, joao@email.com\nMaria Santos, maria@email.com"}
                    rows={8}
                    className="mt-2 font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleBulk} disabled={bulkMutation.isPending}>
                  {bulkMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add individual */}
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Aluno</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do aluno" className="mt-1" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="aluno@email.com" type="email" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Alunos Cadastrados
            {studentsList && <Badge variant="secondary" className="ml-2">{studentsList.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : !studentsList || studentsList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum aluno cadastrado nesta turma.</p>
              <p className="text-sm mt-1">Adicione alunos individualmente, importe via texto ou use o CSV do SAGRES.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-semibold">Matrícula</th>
                    <th className="pb-3 pr-4 font-semibold">Nome</th>
                    <th className="pb-3 pr-4 font-semibold">E-mail</th>
                    <th className="pb-3 font-semibold w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {studentsList.map((student, idx) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="py-3 pr-4 text-sm font-mono text-muted-foreground">{student.enrollment || "—"}</td>
                      <td className="py-3 pr-4 font-medium">{student.name}</td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">{student.email}</td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remover ${student.name}?`)) deleteMutation.mutate({ id: student.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
