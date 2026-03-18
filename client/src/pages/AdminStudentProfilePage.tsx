import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StudentPhotoAvatar } from "@/components/StudentPhotoModal";
import { ArrowLeft, GraduationCap, BookOpen, CheckCircle2, XCircle, Minus } from "lucide-react";

function gradeLabel(val: number | null | undefined): string {
  if (val === null || val === undefined) return "–";
  return val.toFixed(2);
}

function GradeCell({ value, absent }: { value: number | null | undefined; absent?: boolean }) {
  if (absent) return <span className="text-red-500 font-medium">F</span>;
  if (value === null || value === undefined) return <span className="text-muted-foreground">–</span>;
  return <span>{gradeLabel(value)}</span>;
}

export default function AdminStudentProfilePage() {
  const params = useParams<{ studentId: string }>();
  const [, navigate] = useLocation();
  const studentId = parseInt(params.studentId || "0");

  const { data, isLoading, error } = trpc.students.profile.useQuery(
    { studentId },
    { enabled: !!studentId }
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Aluno não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Alunos
        </Button>
      </div>
    );
  }

  const { student, history } = data;
  const byComponent: any[] = (history as any)?.byComponent ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil do Aluno"
        actions={
          <Button variant="outline" onClick={() => navigate("/students")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />

      {/* Student Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <StudentPhotoAvatar
              photoUrl={student.photoUrl}
              studentName={student.name}
              size="lg"
              borderClass="border-2 border-blue-200"
              clickable={true}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xl font-semibold truncate">{student.name}</p>
              <p className="text-sm text-muted-foreground truncate">{student.email || "E-mail não informado"}</p>
              <p className="text-sm text-muted-foreground">Matrícula: <span className="font-medium text-foreground">{student.enrollment}</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History by Component */}
      {byComponent.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium">Nenhum histórico de avaliações encontrado</p>
            <p className="text-sm mt-1">O aluno ainda não participou de nenhuma sessão tutorial.</p>
          </CardContent>
        </Card>
      ) : (
        byComponent.map((comp: any) => (
          <Card key={`${comp.componentCode}-${comp.semester}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {comp.componentCode} — {comp.componentName}
                <Badge variant="secondary" className="ml-auto">{comp.semester}</Badge>
              </CardTitle>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Presenças: <strong className="text-foreground">{comp.presences}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  Faltas: <strong className="text-foreground">{comp.absences}</strong>
                </span>
                {comp.finalAverage !== null && comp.finalAverage !== undefined && (
                  <span className="flex items-center gap-1">
                    <Minus className="h-3.5 w-3.5 text-blue-600" />
                    Média Final: <strong className="text-foreground">{gradeLabel(comp.finalAverage)}</strong>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Sessions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Sessão</th>
                      <th className="text-center py-2 px-2 font-medium">Papel</th>
                      <th className="text-center py-2 px-2 font-medium">Nota Pares</th>
                      <th className="text-center py-2 px-2 font-medium">Nota Tutorial</th>
                      <th className="text-center py-2 px-2 font-medium">Nota Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.sessions.map((s: any) => (
                      <tr key={s.sessionId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-medium">{s.sessionLabel}</td>
                        <td className="text-center py-2 px-2">
                          {s.absent ? (
                            <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Faltou</Badge>
                          ) : s.role ? (
                            <Badge variant="outline" className="text-xs">{s.role}</Badge>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="text-center py-2 px-2">
                          <GradeCell value={s.peerScore} absent={s.absent} />
                        </td>
                        <td className="text-center py-2 px-2">
                          <GradeCell value={s.tutorialScore} absent={s.absent} />
                        </td>
                        <td className="text-center py-2 px-2 font-semibold">
                          <GradeCell value={s.finalScore} absent={s.absent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Problem averages */}
              {comp.problemAverages && comp.problemAverages.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Médias por Problema</p>
                  <div className="flex flex-wrap gap-2">
                    {comp.problemAverages.map((pa: any) => (
                      <div key={pa.problemNumber} className="bg-muted rounded-md px-3 py-1.5 text-sm">
                        <span className="text-muted-foreground">P{pa.problemNumber}: </span>
                        <span className="font-semibold">{gradeLabel(pa.average)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
