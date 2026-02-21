import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, Users, CheckCircle2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function ExportStudentsPage() {
  return (
    <DashboardLayout>
      <ExportStudentsContent />
    </DashboardLayout>
  );
}

function ExportStudentsContent() {
  const { data: classes, isLoading } = trpc.classes.list.useQuery();
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

  // Group classes by semester
  const classesBySemester = useMemo(() => {
    if (!classes) return {};
    const grouped: Record<string, typeof classes> = {};
    for (const cls of classes) {
      if (!grouped[cls.semester]) grouped[cls.semester] = [];
      grouped[cls.semester].push(cls);
    }
    // Sort semesters descending
    const sorted: Record<string, typeof classes> = {};
    Object.keys(grouped).sort().reverse().forEach(k => { sorted[k] = grouped[k]; });
    return sorted;
  }, [classes]);

  const semesters = Object.keys(classesBySemester);

  const toggleClass = (classId: number) => {
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const toggleSemester = (semester: string) => {
    const semesterClassIds = classesBySemester[semester]?.map(c => c.id) || [];
    const allSelected = semesterClassIds.every(id => selectedClassIds.includes(id));
    if (allSelected) {
      setSelectedClassIds(prev => prev.filter(id => !semesterClassIds.includes(id)));
    } else {
      setSelectedClassIds(prev => Array.from(new Set([...prev, ...semesterClassIds])));
    }
  };

  const selectAll = () => {
    if (!classes) return;
    const allIds = classes.map(c => c.id);
    const allSelected = allIds.every(id => selectedClassIds.includes(id));
    setSelectedClassIds(allSelected ? [] : allIds);
  };

  const { data: exportData, isLoading: isExporting, refetch } = trpc.students.exportGoogleWorkspace.useQuery(
    { classIds: selectedClassIds },
    { enabled: false }
  );

  const handleExport = async () => {
    if (selectedClassIds.length === 0) {
      toast.error("Selecione pelo menos uma turma para exportar.");
      return;
    }
    try {
      const result = await refetch();
      if (result.data) {
        // Download CSV file
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        // Build filename from selected semesters
        const selectedSemesters = Array.from(new Set(
          classes?.filter(c => selectedClassIds.includes(c.id)).map(c => c.semester) || []
        ));
        const semesterLabel = selectedSemesters.join("_");
        link.download = `usuarios_google_workspace_${semesterLabel}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`CSV exportado com ${result.data.count} aluno(s)!`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar alunos.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exportar Alunos</h1>
        <p className="text-muted-foreground mt-1">
          Exporte alunos no formato CSV do Google Workspace para adição em lote de usuários.
        </p>
      </div>

      {/* Selection controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Selecionar Turmas
              </CardTitle>
              <CardDescription className="mt-1">
                Selecione as turmas cujos alunos deseja exportar. Turmas agrupadas por semestre.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {classes && classes.every(c => selectedClassIds.includes(c.id)) ? "Desmarcar Todas" : "Selecionar Todas"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!classes || classes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma turma cadastrada.</p>
              <p className="text-sm mt-1">Cadastre turmas e alunos antes de exportar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {semesters.map(semester => {
                const semesterClasses = classesBySemester[semester] || [];
                const semesterClassIds = semesterClasses.map(c => c.id);
                const allSemesterSelected = semesterClassIds.every(id => selectedClassIds.includes(id));
                const someSemesterSelected = semesterClassIds.some(id => selectedClassIds.includes(id));

                return (
                  <div key={semester} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSemester(semester)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          allSemesterSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : someSemesterSelected
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {allSemesterSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        Semestre {semester}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {semesterClasses.length} turma(s)
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 pl-2">
                      {semesterClasses.map(cls => {
                        const isSelected = selectedClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            onClick={() => toggleClass(cls.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                              isSelected
                                ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                                : "bg-card border-border hover:bg-accent/30"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                            </div>
                            <div>
                              <div className="font-medium">{cls.componentCode} - {cls.classCode}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {selectedClassIds.length === 0
                  ? "Nenhuma turma selecionada"
                  : `${selectedClassIds.length} turma(s) selecionada(s)`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O arquivo CSV será gerado no formato do Google Workspace (separado por ponto e vírgula).
              </p>
            </div>
            <Button
              onClick={handleExport}
              disabled={selectedClassIds.length === 0 || isExporting}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p><strong>Formato do CSV:</strong> Google Workspace (29 colunas, separado por ponto e vírgula)</p>
            <p><strong>Senha padrão:</strong> iniciais do nome + matrícula (ex: aatrc20221001)</p>
            <p><strong>Org Unit Path:</strong> /Alunos</p>
            <p><strong>Change Password at Next Sign-In:</strong> True</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
