import { trpc } from "@/lib/trpc";
import { getCurrentSemester } from "@/lib/semesterUtils";
import { useComponentContext } from "@/contexts/ComponentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users, BookOpen, FileSpreadsheet, Check, Pencil, ArrowRightLeft, Camera, AlertTriangle, Filter } from "lucide-react";
import { useState, useRef, useMemo, useEffect } from "react";
import { resizeImageToSquare, base64SizeKB } from "@/lib/resizeImage";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";

export default function StudentsPage() {
  return <StudentsContent />;
}

function StudentsContent() {
  const utils = trpc.useUtils();
  const { selectedComponentId, selectedComponentFullLabel } = useComponentContext();
  const { user } = useAuth();

  // Semestre filter
  const { data: semesters } = trpc.classes.semestersByComponent.useQuery(
    { componentId: selectedComponentId! },
    { enabled: !!selectedComponentId }
  );
  const latestSemester = semesters?.[0] ?? null;
  const [selectedSemester, setSelectedSemester] = useState<string | null>(() => getCurrentSemester());
  useEffect(() => { setSelectedSemester(getCurrentSemester()); }, [selectedComponentId]);

  // Class filter
  const { data: classesList } = trpc.classes.listByComponent.useQuery(
    { componentId: selectedComponentId!, semester: selectedSemester ?? undefined },
    { enabled: !!selectedComponentId }
  );
  const professorClass = classesList?.find((c: any) => c.professorUserId === user?.id);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  useEffect(() => {
    if (classesList && selectedClassId === null) {
      setSelectedClassId(professorClass?.id ?? classesList[0]?.id ?? null);
    }
  }, [classesList]);
  useEffect(() => { setSelectedClassId(null); }, [selectedComponentId, selectedSemester]);

  const { data: myComponents } = trpc.professors.myComponents.useQuery();

  const selectedClass = useMemo(() => {
    if (!classesList || !selectedClassId) return null;
    return (classesList as any[]).find((c: any) => c.id === selectedClassId) ?? null;
  }, [classesList, selectedClassId]);

  const isAdmin = user?.role === "admin";
  const isOwner = selectedClass?.professorUserId === user?.id;
  const isCoordinatorOfComponent = useMemo(() => {
    if (!selectedClass || !myComponents) return false;
    return myComponents.some(
      (c: any) => c.componentId === selectedClass.componentId && c.componentRole === "coordinator" && c.status === "approved"
    );
  }, [selectedClass, myComponents]);
  const canManage = isAdmin || isOwner || isCoordinatorOfComponent;
  const canTransfer = isAdmin || isCoordinatorOfComponent;

  // Other classes of the same component (for transfer target)
  const sameComponentClasses = useMemo(() => {
    if (!classesList || !selectedClass) return [];
    return (classesList as any[]).filter(
      (c: any) => c.componentId === selectedClass.componentId && c.id !== selectedClassId
    );
  }, [classesList, selectedClass, selectedClassId]);

  const { data: studentsList, isLoading } = trpc.students.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno cadastrado com sucesso"); setShowAdd(false); setEnrollmentConflict(null); },
    onError: (e: any) => {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.type === "enrollment_exists_different_data") {
          setEnrollmentConflict(parsed);
          return;
        }
      } catch {}
      toast.error(e.message);
    },
  });
  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno atualizado"); setEditingStudent(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const resolveConflictMutation = trpc.students.resolveImportConflict.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const importCSVMutation = trpc.students.importCSV.useMutation({
    onSuccess: (data) => {
      utils.students.list.invalidate();
      let msg = `${data.count} alunos processados: ${data.created} novos, ${data.linked} vinculados`;
      if (data.alreadyInClass > 0) msg += `, ${data.alreadyInClass} já na turma`;
      if (data.conflicts.length > 0) {
        setImportConflicts(data.conflicts);
      }
      if (data.nameMismatches && data.nameMismatches.length > 0) {
        setImportNameMismatches(data.nameMismatches);
        toast.warning(`${data.nameMismatches.length} aluno(s) com divergência de nome. Resolva os conflitos abaixo.`);
      } else if (data.conflicts.length === 0) {
        toast.success(msg);
        setShowCSVImport(false);
        setCsvPreview(null);
        setCsvContent("");
      } else {
        toast.warning(`${data.conflicts.length} aluno(s) não importado(s): já cadastrado(s) em outra turma deste componente.`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMutation = trpc.students.removeFromClass.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno removido da turma. As avaliações anteriores foram preservadas."); },
    onError: (e: any) => toast.error(e.message),
  });
  const transferMutation = trpc.students.transfer.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
      toast.success("Aluno transferido com sucesso. As avaliações anteriores foram preservadas.");
      setTransferringStudent(null);
      setTransferTargetClassId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [enrollmentConflict, setEnrollmentConflict] = useState<{ existingName: string; existingEmail: string | null; inputName: string; inputEmail: string | null } | null>(null);
  const [importNameMismatches, setImportNameMismatches] = useState<{ csvName: string; enrollment: string; existingName: string; existingEmail: string | null }[]>([]);
  const [importConflicts, setImportConflicts] = useState<{ name: string; enrollment: string }[]>([]);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [csvPreview, setCsvPreview] = useState<{ name: string; enrollment: string }[] | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: number; name: string; enrollment: string; email: string | null; photoUrl: string | null } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnrollment, setEditEnrollment] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const [transferringStudent, setTransferringStudent] = useState<{ id: number; name: string; enrollment: string } | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedComponentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione um Componente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione um componente no menu lateral para gerenciar alunos.
        </p>
      </div>
    );
  }

  const handleAdd = (useExisting?: boolean) => {
     if (!newName.trim() || !newEnrollment.trim()) { toast.error("Preencha nome e matrícula"); return; }
    createMutation.mutate({
      classId: selectedClassId!,
      name: newName.trim(),
      enrollment: newEnrollment.trim(),
      email: newEmail.trim() || undefined,
      useExisting: useExisting || undefined,
    });
    if (!useExisting) {
      setNewName(""); setNewEnrollment(""); setNewEmail("");
    }
  };

  const uploadPhotoMutation = trpc.studentAccess.uploadPhoto.useMutation({
    onError: (e: any) => toast.error(e.message || "Erro ao enviar foto"),
  });

  const handleEdit = async () => {
    if (!editingStudent) return;
    if (!editName.trim() || !editEnrollment.trim()) { toast.error("Preencha nome e matrícula"); return; }
    let photoUrl: string | null | undefined = undefined;
    // If new photo file, upload first
    if (editPhotoFile) {
      try {
        const result = await uploadPhotoMutation.mutateAsync({
          studentId: editingStudent.id,
          photoBase64: editPhotoFile.base64,
          mimeType: editPhotoFile.mimeType,
        });
        photoUrl = result.photoUrl;
      } catch {
        return; // error already shown by mutation
      }
    }
    updateMutation.mutate({
      studentId: editingStudent.id,
      classId: selectedClassId!,
      name: editName.trim(),
      enrollment: editEnrollment.trim(),
      email: editEmail.trim() || null,
      ...(photoUrl !== undefined ? { photoUrl } : {}),
    });
  };

  const startEdit = (student: { id: number; name: string; enrollment: string; email: string | null; photoUrl: string | null }) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEnrollment(student.enrollment);
    setEditEmail(student.email || "");
    setEditPhotoUrl(student.photoUrl);
    setEditPhotoFile(null);
  };

  const handleEditPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Foto deve ter no máximo 10MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    try {
      const resized = await resizeImageToSquare(file, 150, 0.7);
      const previewUrl = `data:${resized.mimeType};base64,${resized.base64}`;
      setEditPhotoUrl(previewUrl);
      setEditPhotoFile(resized);
      toast.success(`Foto redimensionada para 150x150px (~${base64SizeKB(resized.base64)}KB)`);
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const handleTransfer = () => {
    if (!transferringStudent || !transferTargetClassId) {
      toast.error("Selecione a turma de destino");
      return;
    }
    transferMutation.mutate({
      studentId: transferringStudent.id,
      fromClassId: selectedClassId!,
      toClassId: parseInt(transferTargetClassId),
    });
  };

  const parseCSVPreview = (content: string) => {
    // Robust SAGRES Folha de Frequência parser.
    // Strategy: scan every row for a cell that looks like an 8-digit enrollment number
    // (digits only, possibly surrounded by whitespace). The cell immediately after it
    // is the student name. This handles all known column-offset variants:
    //   Format A (TP01-TP04): Nº;;Matrícula; Aluno  → enrollment at col[2], name at col[3]
    //   Format B (TP01 alt):  ;Nº;;Matrícula; Aluno → enrollment at col[3], name at col[4]
    //   Format C (DevExpress warning header): same as B but with extra leading row
    const ENROLLMENT_RE = /^\s*\d{5,11}\s*$/; // 5-11 digits, tolerant of leading/trailing spaces
    const HEADER_NAME_RE = /aluno|nome/i;       // skip header rows
    // Auto-detect delimiter: count semicolons vs commas in the first 10 non-empty lines
    const sampleLines = content.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
    const semicolonCount = sampleLines.join("").split(";").length - 1;
    const commaCount = sampleLines.join("").split(",").length - 1;
    const delimiter = commaCount > semicolonCount ? "," : ";";
    const parsed: { name: string; enrollment: string }[] = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const cols = line.split(delimiter);
      // Find the first column that looks like an enrollment number
      let enrollmentIdx = -1;
      for (let i = 0; i < cols.length; i++) {
        if (ENROLLMENT_RE.test(cols[i])) {
          enrollmentIdx = i;
          break;
        }
      }
      if (enrollmentIdx === -1) continue;
      const enrollment = cols[enrollmentIdx].trim();
      const name = cols[enrollmentIdx + 1]?.trim();
      if (!name || HEADER_NAME_RE.test(name)) continue;
      // Reject lines where the "name" column is clearly not a name (e.g. all underscores)
      if (/^[_\s]+$/.test(name)) continue;
      parsed.push({ name, enrollment });
    }
    return parsed;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      const preview = parseCSVPreview(text);
      setCsvPreview(preview);
      if (preview.length === 0) {
        toast.error("Nenhum aluno encontrado no arquivo. Verifique se é uma Folha de Frequência do SAGRES.");
      } else {
        toast.success(`${preview.length} alunos encontrados no arquivo`);
      }
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const handleCSVImport = () => {
    if (!csvContent) { toast.error("Selecione um arquivo CSV"); return; }
    importCSVMutation.mutate({ classId: selectedClassId!, csvContent });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          {selectedComponentFullLabel && (
            <p className="text-sm font-semibold text-primary mt-0.5">{selectedComponentFullLabel}</p>
          )}
          <p className="text-muted-foreground mt-1 text-sm">
            {canManage ? "Gerencie os alunos da turma selecionada." : "Visualize os alunos da turma selecionada."}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Semestre:</Label>
            <Select
              value={selectedSemester ?? getCurrentSemester()}
              onValueChange={(v) => setSelectedSemester(v || null)}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Semestre" />
              </SelectTrigger>
              <SelectContent>
                {(semesters ?? []).map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Turma:</Label>
            <Select
              value={selectedClassId ? String(selectedClassId) : ""}
              onValueChange={(v) => setSelectedClassId(parseInt(v))}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Turma" />
              </SelectTrigger>
              <SelectContent>
                {(classesList ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                    {c.classCode}{c.professorUserId === user?.id ? " (minha)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {canManage && <div className="flex gap-2">
          {/* CSV Import from SAGRES */}
          <Dialog open={showCSVImport} onOpenChange={(open) => {
            setShowCSVImport(open);
            if (!open) { setCsvPreview(null); setCsvContent(""); }
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

                <p className="text-xs text-muted-foreground">
                  O e-mail não é definido na importação. O aluno poderá informar seu e-mail ao acessar a avaliação de pares.
                  Se o aluno já existir no sistema (mesma matrícula), ele será apenas vinculado a esta turma.
                </p>

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
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((s, i) => (
                              <tr key={i} className="border-t hover:bg-accent/20">
                                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-2 font-mono text-xs">{s.enrollment}</td>
                                <td className="px-3 py-2">{s.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {/* Name mismatch conflicts from import */}
                {importConflicts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Alunos não importados — já cadastrados neste componente</p>
                        <p className="text-xs text-red-700 mt-1">
                          Os alunos abaixo já estão em outra turma deste mesmo componente e não podem ser adicionados novamente.
                        </p>
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                            <th className="px-3 py-2 text-left font-medium">Nome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importConflicts.map((c, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">{c.enrollment}</td>
                              <td className="px-3 py-2">{c.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setImportConflicts([]); setShowCSVImport(false); setCsvPreview(null); setCsvContent(""); }}>
                      Fechar
                    </Button>
                  </div>
                )}
                {importNameMismatches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Diverg\u00eancias de nome detectadas</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Os alunos abaixo j\u00e1 existem no sistema com nomes diferentes. Escolha como resolver cada caso.
                        </p>
                      </div>
                    </div>
                    {importNameMismatches.map((m, i) => (
                      <div key={i} className="p-3 rounded-lg border border-amber-200 bg-white space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">{m.enrollment}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 rounded bg-muted/50 border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Nome no banco</p>
                            <p className="font-medium">{m.existingName}</p>
                            {m.existingEmail && <p className="text-xs text-muted-foreground">{m.existingEmail}</p>}
                          </div>
                          <div className="p-2 rounded bg-muted/50 border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Nome no CSV</p>
                            <p className="font-medium">{m.csvName}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={async () => {
                            await resolveConflictMutation.mutateAsync({ classId: selectedClassId!, enrollment: m.enrollment, action: "use_existing" });
                            setImportNameMismatches(prev => prev.filter((_, idx) => idx !== i));
                            toast.success(`${m.existingName} vinculado \u00e0 turma (dados do banco mantidos)`);
                          }} disabled={resolveConflictMutation.isPending}>
                            Usar dados do banco
                          </Button>
                          <Button size="sm" variant="outline" onClick={async () => {
                            await resolveConflictMutation.mutateAsync({ classId: selectedClassId!, enrollment: m.enrollment, action: "update_name", csvName: m.csvName });
                            setImportNameMismatches(prev => prev.filter((_, idx) => idx !== i));
                            toast.success(`Nome atualizado para ${m.csvName} e vinculado \u00e0 turma`);
                          }} disabled={resolveConflictMutation.isPending}>
                            Usar nome do CSV
                          </Button>
                        </div>
                      </div>
                    ))}
                    {importNameMismatches.length === 0 && (
                      <p className="text-sm text-emerald-600 font-medium">Todos os conflitos foram resolvidos.</p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCSVImport}
                  disabled={importCSVMutation.isPending || !csvPreview || csvPreview.length === 0 || importNameMismatches.length > 0}
                >
                  {importCSVMutation.isPending ? "Importando..." : `Importar ${csvPreview?.length ?? 0} Alunos`}
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
                  <Label>Matrícula *</Label>
                  <Input value={newEnrollment} onChange={e => setNewEnrollment(e.target.value)} placeholder="20221001" className="mt-1" />
                </div>
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do aluno" className="mt-1" />
                </div>
                <div>
                  <Label>E-mail (opcional)</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="aluno@ecomp.uefs.br" type="email" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">O aluno poderá informar o e-mail ao acessar a avaliação.</p>
                </div>

                {/* Enrollment conflict alert */}
                {enrollmentConflict && (
                  <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Matrícula já cadastrada em outro componente</p>
                        <p className="text-xs text-amber-700 mt-1">Esta matrícula já existe no sistema com dados diferentes. Verifique se é o mesmo aluno.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 rounded bg-white border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Dados no banco</p>
                        <p className="font-medium">{enrollmentConflict.existingName}</p>
                        {enrollmentConflict.existingEmail && <p className="text-xs text-muted-foreground">{enrollmentConflict.existingEmail}</p>}
                      </div>
                      <div className="p-2 rounded bg-white border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Dados informados</p>
                        <p className="font-medium">{enrollmentConflict.inputName}</p>
                        {enrollmentConflict.inputEmail && <p className="text-xs text-muted-foreground">{enrollmentConflict.inputEmail}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { handleAdd(true); setEnrollmentConflict(null); }}>
                        Importar do banco
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEnrollmentConflict(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => handleAdd()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>}
      </div>

      {/* Edit student dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) setEditingStudent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Foto do aluno */}
            <div className="flex flex-col items-center gap-2">
              <Label>Foto do Aluno</Label>
              <div className="relative">
                {editPhotoUrl ? (
                  <img src={editPhotoUrl} alt="Foto" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={() => editPhotoInputRef.current?.click()}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <input ref={editPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditPhotoSelect} />
              </div>
              <p className="text-xs text-muted-foreground">Professor pode alterar a foto sem verificação.</p>
            </div>
            <div>
              <Label>Matrícula *</Label>
              <Input value={editEnrollment} onChange={e => setEditEnrollment(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Professor pode alterar o e-mail sem código de confirmação.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateMutation.isPending || uploadPhotoMutation.isPending}>
              {(updateMutation.isPending || uploadPhotoMutation.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer student dialog */}
      <Dialog open={!!transferringStudent} onOpenChange={(open) => {
        if (!open) { setTransferringStudent(null); setTransferTargetClassId(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferir Aluno
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-accent/30 border">
              <p className="text-sm font-medium">{transferringStudent?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{transferringStudent?.enrollment}</p>
            </div>

            <div>
              <Label>Turma de destino</Label>
              {sameComponentClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Não há outras turmas neste componente para transferir o aluno.
                </p>
              ) : (
                <Select value={transferTargetClassId} onValueChange={setTransferTargetClassId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a turma de destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sameComponentClasses.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.classCode} — {(c as any).componentCode ?? ""} ({c.semester})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
              <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>
                O aluno será removido desta turma e adicionado à turma de destino. <strong>As avaliações já realizadas serão preservadas.</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferringStudent(null); setTransferTargetClassId(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending || !transferTargetClassId || sameComponentClasses.length === 0}
            >
              {transferMutation.isPending ? "Transferindo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Alunos da Turma
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
              <p className="text-sm mt-1">Adicione alunos individualmente ou importe via CSV do SAGRES.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-semibold w-12"></th>
                    <th className="pb-3 pr-4 font-semibold">Matrícula</th>
                    <th className="pb-3 pr-4 font-semibold">Nome</th>
                    <th className="pb-3 pr-4 font-semibold">E-mail</th>
                    <th className="pb-3 font-semibold w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {studentsList.map((student: any) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="py-3 pr-4">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs font-medium text-muted-foreground">{student.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm font-mono">{student.enrollment}</td>
                      <td className="py-3 pr-4 font-medium">{student.name}</td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">{student.email || <span className="italic text-muted-foreground/50">não informado</span>}</td>
                      <td className="py-3 flex gap-1">
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit({ id: student.id, name: student.name, enrollment: student.enrollment, email: student.email, photoUrl: student.photoUrl })}
                              title="Editar aluno"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canTransfer && sameComponentClasses.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => setTransferringStudent({ id: student.id, name: student.name, enrollment: student.enrollment })}
                                title="Transferir para outra turma"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm(`Remover ${student.name} desta turma? As avaliações anteriores serão preservadas.`)) removeMutation.mutate({ studentId: student.id, classId: selectedClassId! });
                              }}
                              title="Remover da turma"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
