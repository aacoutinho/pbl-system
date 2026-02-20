import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useClassContext } from "@/contexts/ClassContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Trophy, UserX, BookOpen, Info, Eye } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

export default function ResultsPage() {
  return (
    <DashboardLayout>
      <ResultsContent />
    </DashboardLayout>
  );
}

function ResultsContent() {
  const { selectedClassId } = useClassContext();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Cross-class: load all classes for professors
  const { data: allClasses } = trpc.classes.listAll.useQuery(undefined, { enabled: isAdmin });

  // Active class for viewing results (default = own class)
  const [viewingClassId, setViewingClassId] = useState<number | null>(null);
  const activeClassId = viewingClassId ?? selectedClassId;

  // Reset viewingClassId when selectedClassId changes
  useEffect(() => {
    setViewingClassId(null);
  }, [selectedClassId]);

  // Use sessionsForClass for cross-class, or sessions.list for own class
  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery(
    { classId: activeClassId! },
    { enabled: !!activeClassId && (!viewingClassId || viewingClassId === selectedClassId) }
  );
  const { data: crossSessionsList, isLoading: crossSessionsLoading } = trpc.results.sessionsForClass.useQuery(
    { classId: viewingClassId! },
    { enabled: !!viewingClassId && viewingClassId !== selectedClassId }
  );

  const activeSessions = viewingClassId && viewingClassId !== selectedClassId ? crossSessionsList : sessionsList;
  const activeSessionsLoading = viewingClassId && viewingClassId !== selectedClassId ? crossSessionsLoading : sessionsLoading;

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedProblem, setSelectedProblem] = useState<string>("");

  // Reset selections when class changes
  useEffect(() => {
    setSelectedSessionId("");
    setSelectedProblem("");
  }, [activeClassId]);

  // Peer results
  const { data: sessionResults, isLoading: resultsLoading } = trpc.results.session.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Final grades (with tutorial evaluation)
  const { data: finalResults, isLoading: finalLoading } = trpc.results.sessionFinal.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Tutorial evaluation info
  const { data: tutorialEval } = trpc.tutorialEval.get.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Problem-level results
  const { data: problemResults, isLoading: problemLoading } = trpc.results.problem.useQuery(
    { classId: activeClassId!, problemNumber: parseInt(selectedProblem) },
    { enabled: !!selectedProblem && !!activeClassId }
  );

  // Problem-level final grades
  const { data: problemFinalResults, isLoading: problemFinalLoading } = trpc.results.problemFinal.useQuery(
    { classId: activeClassId!, problemNumber: parseInt(selectedProblem) },
    { enabled: !!selectedProblem && !!activeClassId }
  );

  const problems = useMemo(() => {
    if (!activeSessions) return [];
    const pSet = new Set(activeSessions.map(s => s.problemNumber));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [activeSessions]);

  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione uma Turma</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione uma turma no menu lateral para ver os resultados.
        </p>
      </div>
    );
  }

  const viewingOtherClass = viewingClassId && viewingClassId !== selectedClassId;
  const viewingClassName = allClasses?.find(c => c.id === viewingClassId)?.name;

  const exportCSV = (data: Array<Record<string, unknown>>, filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSessionCSV = () => {
    if (!finalResults) return;
    const session = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    exportCSV(
      finalResults.map((r, i) => ({
        Posição: i + 1,
        Aluno: r.studentName,
        Email: r.studentEmail,
        Papel: r.role,
        "Nota Pares": r.peerScore.toFixed(1),
        "Nota Final": r.finalGrade.toFixed(1),
        "Avaliações Válidas": r.validEvaluations,
        Ausente: r.absent ? "Sim" : "Não",
      })),
      `resultados_${session?.label?.replace(/\s/g, "_") || "sessao"}.csv`
    );
  };

  const exportProblemCSV = () => {
    if (!problemFinalResults) return;
    const sessionsForProblem = activeSessions?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber) ?? [];
    exportCSV(
      problemFinalResults.map((r, i) => {
        const row: Record<string, unknown> = {
          Posição: i + 1,
          Aluno: r.studentName,
          Email: r.studentEmail,
        };
        sessionsForProblem.forEach((s, idx) => {
          row[`S${s.sessionNumber} Pares`] = r.peerScores[idx]?.toFixed(1) ?? "0.0";
          row[`S${s.sessionNumber} Final`] = r.finalGrades[idx]?.toFixed(1) ?? "0.0";
        });
        row["Média Pares"] = r.peerAverage.toFixed(1);
        row["Média Final"] = r.finalAverage.toFixed(1);
        return row;
      }),
      `resultados_problema_${selectedProblem}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resultados</h1>
        <p className="text-muted-foreground mt-1">Visualize e exporte as notas calculadas automaticamente.</p>
      </div>

      {/* Cross-class selector for professors */}
      {isAdmin && allClasses && allClasses.length > 1 && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              <Label className="text-sm whitespace-nowrap">Visualizar turma:</Label>
              <Select
                value={String(activeClassId)}
                onValueChange={(v) => setViewingClassId(parseInt(v))}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Selecione uma turma..." />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.code}){c.professorUserId === user?.id ? " — Minha turma" : ` — Prof. ${c.professorName || "N/A"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {viewingOtherClass && (
                <Badge variant="secondary" className="text-xs">
                  Visualizando: {viewingClassName}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="session" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session">Por Sessão</TabsTrigger>
          <TabsTrigger value="problem">Por Problema</TabsTrigger>
        </TabsList>

        {/* ─── Session Results ─── */}
        <TabsContent value="session" className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 max-w-xs">
              <Label>Selecione a sessão</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha uma sessão..." />
                </SelectTrigger>
                <SelectContent>
                  {activeSessionsLoading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    activeSessions?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {finalResults && finalResults.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportSessionCSV}>
                <Download className="h-4 w-4 mr-2" />Exportar CSV
              </Button>
            )}
          </div>

          {selectedSessionId && (
            <>
              {/* Tutorial evaluation info */}
              {tutorialEval ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Avaliação do Tutorial pelo Professor</p>
                    <p className="mt-1">
                      Org: {Number(tutorialEval.organizacao).toFixed(1)}×1 + 
                      Coop: {Number(tutorialEval.cooperacao).toFixed(1)}×1 + 
                      Cont: {Number(tutorialEval.conteudo).toFixed(1)}×3 + 
                      Obj: {Number(tutorialEval.objetivo).toFixed(1)}×3 + 
                      Metas: {Number(tutorialEval.metas).toFixed(1)}×2 = {" "}
                      <span className="font-bold">{tutorialEval.tutorialGrade.toFixed(1)}</span>
                    </p>
                    <p className="mt-1 text-xs">
                      Alunos presentes: {finalResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0} | 
                      Pontuação total: {tutorialEval.tutorialGrade.toFixed(1)} × {finalResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0} = {((tutorialEval.tutorialGrade) * (finalResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0)).toFixed(1)} pontos
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>O professor ainda não avaliou esta sessão tutorial. A nota final será calculada após a avaliação do tutorial.</p>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ranking da Sessão
                  </CardTitle>
                  <CardDescription>
                    {tutorialEval 
                      ? "Notas finais calculadas com distribuição proporcional baseada na avaliação do tutorial."
                      : "Mostrando apenas notas da avaliação pelos pares. Avalie o tutorial para ver as notas finais."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(resultsLoading || finalLoading) ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                  ) : !finalResults || finalResults.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma avaliação encontrada para esta sessão.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-4 font-semibold w-12">#</th>
                            <th className="pb-3 pr-4 font-semibold">Aluno</th>
                            <th className="pb-3 pr-4 font-semibold">Papel</th>
                            <th className="pb-3 pr-4 font-semibold text-center">Nota Pares</th>
                            {tutorialEval && <th className="pb-3 pr-4 font-semibold text-center">Nota Final</th>}
                            <th className="pb-3 font-semibold text-center">Avaliações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finalResults.map((r, i) => (
                            <tr key={r.studentId} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                              <td className="py-3 pr-4">
                                {i < 3 && !r.absent ? (
                                  <Trophy className={`h-4 w-4 ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                                ) : (
                                  <span className="text-muted-foreground">{i + 1}</span>
                                )}
                              </td>
                              <td className="py-3 pr-4">
                                <p className="font-medium">{r.studentName}</p>
                              </td>
                              <td className="py-3 pr-4">
                                <RoleBadge role={r.role} />
                              </td>
                              <td className="py-3 pr-4 text-center">
                                <span className={`font-medium ${r.absent ? "text-muted-foreground" : r.peerScore >= 8 ? "text-emerald-600" : r.peerScore >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                  {r.peerScore.toFixed(1)}
                                </span>
                              </td>
                              {tutorialEval && (
                                <td className="py-3 pr-4 text-center">
                                  <span className={`font-bold text-base ${r.absent ? "text-muted-foreground" : r.finalGrade >= 8 ? "text-emerald-600" : r.finalGrade >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                    {r.finalGrade.toFixed(1)}
                                  </span>
                                </td>
                              )}
                              <td className="py-3 text-center text-muted-foreground">{r.validEvaluations}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Problem Results ─── */}
        <TabsContent value="problem" className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label>Selecione o problema</Label>
              <Select value={selectedProblem} onValueChange={setSelectedProblem}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha um problema..." />
                </SelectTrigger>
                <SelectContent>
                  {problems.map(p => (
                    <SelectItem key={p} value={String(p)}>Problema {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {problemFinalResults && problemFinalResults.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportProblemCSV}>
                <Download className="h-4 w-4 mr-2" />Exportar CSV
              </Button>
            )}
          </div>

          {selectedProblem && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Notas Finais do Problema {selectedProblem}
                </CardTitle>
                <CardDescription>
                  Média das notas finais de desempenho em todas as sessões do problema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(problemLoading || problemFinalLoading) ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : !problemFinalResults || problemFinalResults.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado para este problema.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-4 font-semibold w-12">#</th>
                          <th className="pb-3 pr-4 font-semibold">Aluno</th>
                          {activeSessions?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber).map(s => (
                            <th key={s.id} className="pb-3 pr-2 font-semibold text-center" colSpan={2}>
                              S{s.sessionNumber}
                            </th>
                          ))}
                          <th className="pb-3 pr-2 font-semibold text-center">Média Pares</th>
                          <th className="pb-3 font-semibold text-center">Média Final</th>
                        </tr>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-4"></th>
                          <th className="pb-2 pr-4"></th>
                          {activeSessions?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber).map(s => (
                            <React.Fragment key={s.id}>
                              <th className="pb-2 pr-1 text-center">Pares</th>
                              <th className="pb-2 pr-2 text-center">Final</th>
                            </React.Fragment>
                          ))}
                          <th className="pb-2 pr-2"></th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemFinalResults.map((r, i) => (
                          <tr key={r.studentId} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                            <td className="py-3 pr-4">
                              {i < 3 ? (
                                <Trophy className={`h-4 w-4 ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                              ) : (
                                <span className="text-muted-foreground">{i + 1}</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <p className="font-medium">{r.studentName}</p>
                            </td>
                            {r.peerScores.map((score, idx) => (
                              <React.Fragment key={idx}>
                                <td className="py-3 pr-1 text-center">
                                  <span className={score === 0 ? "text-muted-foreground" : "text-sm"}>{score.toFixed(1)}</span>
                                </td>
                                <td className="py-3 pr-2 text-center">
                                  <span className={r.finalGrades[idx] === 0 ? "text-muted-foreground" : "text-sm font-medium"}>
                                    {r.finalGrades[idx]?.toFixed(1) ?? "0.0"}
                                  </span>
                                </td>
                              </React.Fragment>
                            ))}
                            <td className="py-3 pr-2 text-center">
                              <span className={r.peerAverage === 0 ? "text-muted-foreground" : ""}>
                                {r.peerAverage.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`font-bold ${r.finalAverage >= 8 ? "text-emerald-600" : r.finalAverage >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                {r.finalAverage.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    COORDENADOR: "bg-blue-50 text-blue-700 border-blue-200",
    MESA: "bg-purple-50 text-purple-700 border-purple-200",
    QUADRO: "bg-teal-50 text-teal-700 border-teal-200",
    PARTICIPANTE: "bg-gray-50 text-gray-600 border-gray-200",
    FALTOU: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <Badge variant="outline" className={styles[role] || styles.PARTICIPANTE}>
      {role === "FALTOU" && <UserX className="h-3 w-3 mr-1" />}
      {role}
    </Badge>
  );
}
