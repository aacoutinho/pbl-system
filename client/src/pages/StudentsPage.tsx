import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Users, BookOpen, FileSpreadsheet, Check, Pencil, ArrowRightLeft } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const { user } = useAuth();

  // Check permissions for the selected class
  const { data: classesList } = trpc.classes.list.useQuery();
  const { data: myComponents } = trpc.professors.myComponents.useQuery();

  const selectedClass = useMemo(() => {
    if (!classesList || !selectedClassId) return null;
    return classesList.find(c => c.id === selectedClassId) ?? null;
  }, [classesList, selectedClassId]);

  const isAdmin = user?.role === "admin";
  const isOwner = selectedClass?.professorUserId === user?.id;
  const isCoordinatorOfComponent = useMemo(() => {
    if (!selectedClass || !myComponents) return false;
    return myComponents.some(
      c => c.componentId === selectedClass.componentId && c.componentRole === "coordinator" && c.status === "approved"
    );
  }, [selectedClass, myComponents]);
  const canManage = isAdmin || isOwner || isCoordinatorOfComponent;
  const canTransfer = isAdmin || isCoordinatorOfComponent;

  // Other classes of the same component (for transfer target)
  const sameComponentClasses = useMemo(() => {
    if (!classesList || !selectedClass) return [];
    return classesList.filter(
      c => c.componentId === selectedClass.componentId && c.id !== selectedClassId
    );
  }, [classesList, selectedClass, selectedClassId]);

  const { data: studentsList, isLoading } = trpc.students.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno cadastrado com sucesso"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => { utils.students.list.invalidate(); toast.success("Aluno atualizado"); setEditingStudent(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const importCSVMutation = trpc.students.importCSV.useMutation({
    onSuccess: (data) => {
      utils.students.list.invalidate();
      let msg = `${data.count} alunos processados: ${data.created} novos, ${data.linked} vinculados`;
      if (data.alreadyInClass > 0) msg += `, ${data.alreadyInClass} já na turma`;
      if (data.conflicts.length > 0) msg += `. ${data.conflicts.length} conflitos (já em outra turma do componente)`;
      toast.success(msg);
      setShowCSVImport(false);
      setCsvPreview(null);
      setCsvContent("");
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
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [csvPreview, setCsvPreview] = useState<{ name: string; enrollment: string }[] | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: number; name: string; enrollment: string; email: string | null } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnrollment, setEditEnrollment] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [transferringStudent, setTransferringStudent] = useState<{ id: number; name: string; enrollment: string } | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState<string>("");
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
    if (!newName.trim() || !newEnrollment.trim()) { toast.error("Preencha nome e matrícula"); return; }
    createMutation.mutate({
      classId: selectedClassId,
      name: newName.trim(),
      enrollment: newEnrollment.trim(),
      email: newEmail.trim() || undefined,
    });
    setNewName(""); setNewEnrollment(""); setNewEmail("");
  };

  const handleEdit = () => {
    if (!editingStudent) return;
    if (!editName.trim() || !editEnrollment.trim()) { toast.error("Preencha nome e matrícula"); return; }
    updateMutation.mutate({
      studentId: editingStudent.id,
      classId: selectedClassId,
      name: editName.trim(),
      enrollment: editEnrollment.trim(),
      email: editEmail.trim() || null,
    });
  };

  const startEdit = (student: { id: number; name: string; enrollment: string; email: string | null }) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditEnrollment(student.enrollment);
    setEditEmail(student.email || "");
  };

  const handleTransfer = () => {
    if (!transferringStudent || !transferTargetClassId) {
      toast.error("Selecione a turma de destino");
      return;
    }
    transferMutation.mutate({
      studentId: transferringStudent.id,
      fromClassId: selectedClassId,
      toClassId: parseInt(transferTargetClassId),
    });
  };

  const parseCSVPreview = (content: string) => {
    const lines = content.split("\n");
    const parsed: { name: string; enrollment: string }[] = [];
    for (const line of lines) {
      const cols = line.split(";");
      const num = cols[1]?.trim();
      if (!num || isNaN(parseInt(num))) continue;
      const enrollment = cols[3]?.trim();
      const name = cols[4]?.trim();
      if (!name || !enrollment) continue;
      if (name === "Aluno" || enrollment === "Matrícula") continue;
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
    importCSVMutation.mutate({ classId: selectedClassId, csvContent });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? "Gerencie os alunos da turma selecionada." : "Visualize os alunos da turma selecionada."}
          </p>
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
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={createMutation.isPending}>
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
            <div>
              <Label>Matrícula *</Label>
              <Input value={editEnrollment} onChange={e => setEditEnrollment(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>E-mail (opcional)</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
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
                    <th className="pb-3 pr-4 font-semibold">Matrícula</th>
                    <th className="pb-3 pr-4 font-semibold">Nome</th>
                    <th className="pb-3 pr-4 font-semibold">E-mail</th>
                    <th className="pb-3 font-semibold w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {studentsList.map((student: any) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
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
                              onClick={() => startEdit({ id: student.id, name: student.name, enrollment: student.enrollment, email: student.email })}
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
                                if (confirm(`Remover ${student.name} desta turma? As avaliações anteriores serão preservadas.`)) removeMutation.mutate({ studentId: student.id, classId: selectedClassId });
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
