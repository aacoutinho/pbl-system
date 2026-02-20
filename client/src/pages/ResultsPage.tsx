import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Trophy, UserX } from "lucide-react";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsPage() {
  return (
    <DashboardLayout>
      <ResultsContent />
    </DashboardLayout>
  );
}

function ResultsContent() {
  const { data: sessionsList, isLoading: sessionsLoading } = trpc.sessions.list.useQuery();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedProblem, setSelectedProblem] = useState<string>("");

  const { data: sessionResults, isLoading: resultsLoading } = trpc.results.session.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  const { data: problemResults, isLoading: problemLoading } = trpc.results.problem.useQuery(
    { problemNumber: parseInt(selectedProblem) },
    { enabled: !!selectedProblem }
  );

  const problems = useMemo(() => {
    if (!sessionsList) return [];
    const pSet = new Set(sessionsList.map(s => s.problemNumber));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [sessionsList]);

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
    if (!sessionResults) return;
    const session = sessionsList?.find(s => s.id === parseInt(selectedSessionId));
    exportCSV(
      sessionResults.map((r, i) => ({
        Posição: i + 1,
        Aluno: r.studentName,
        Email: r.studentEmail,
        Papel: r.role,
        Nota: r.totalScore,
        "Avaliações Válidas": r.validEvaluations,
        Ausente: r.absent ? "Sim" : "Não",
      })),
      `resultados_${session?.label?.replace(/\s/g, "_") || "sessao"}.csv`
    );
  };

  const exportProblemCSV = () => {
    if (!problemResults) return;
    const sessionsForProblem = sessionsList?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber) ?? [];
    exportCSV(
      problemResults.map((r, i) => {
        const row: Record<string, unknown> = {
          Posição: i + 1,
          Aluno: r.studentName,
          Email: r.studentEmail,
        };
        sessionsForProblem.forEach((s, idx) => {
          row[`S${s.sessionNumber}`] = r.sessionScores[idx] ?? 0;
        });
        row["Média Geral"] = r.average;
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

      <Tabs defaultValue="session" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session">Por Sessão</TabsTrigger>
          <TabsTrigger value="problem">Por Problema</TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label>Selecione a sessão</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Escolha uma sessão..." />
                </SelectTrigger>
                <SelectContent>
                  {sessionsLoading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : (
                    sessionsList?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {sessionResults && sessionResults.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportSessionCSV}>
                <Download className="h-4 w-4 mr-2" />Exportar CSV
              </Button>
            )}
          </div>

          {selectedSessionId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Ranking da Sessão
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resultsLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : !sessionResults || sessionResults.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma avaliação encontrada para esta sessão.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-4 font-semibold w-12">#</th>
                          <th className="pb-3 pr-4 font-semibold">Aluno</th>
                          <th className="pb-3 pr-4 font-semibold">Papel</th>
                          <th className="pb-3 pr-4 font-semibold text-center">Nota</th>
                          <th className="pb-3 font-semibold text-center">Avaliações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionResults.map((r, i) => (
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
                              <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <RoleBadge role={r.role} />
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <span className={`font-bold text-base ${r.absent ? "text-muted-foreground" : r.totalScore >= 8 ? "text-emerald-600" : r.totalScore >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                {r.totalScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 text-center text-muted-foreground">{r.validEvaluations}</td>
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
            {problemResults && problemResults.length > 0 && (
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
                  Média Geral do Problema {selectedProblem}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {problemLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : !problemResults || problemResults.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado para este problema.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-4 font-semibold w-12">#</th>
                          <th className="pb-3 pr-4 font-semibold">Aluno</th>
                          {sessionsList?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber).map(s => (
                            <th key={s.id} className="pb-3 pr-4 font-semibold text-center">S{s.sessionNumber}</th>
                          ))}
                          <th className="pb-3 font-semibold text-center">Média</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemResults.map((r, i) => (
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
                            {r.sessionScores.map((score, idx) => (
                              <td key={idx} className="py-3 pr-4 text-center">
                                <span className={score === 0 ? "text-muted-foreground" : ""}>{score.toFixed(2)}</span>
                              </td>
                            ))}
                            <td className="py-3 text-center">
                              <span className={`font-bold ${r.average >= 8 ? "text-emerald-600" : r.average >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                {r.average.toFixed(2)}
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
