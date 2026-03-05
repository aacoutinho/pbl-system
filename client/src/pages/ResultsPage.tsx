import { trpc } from "@/lib/trpc";
import { getCurrentSemester } from "@/lib/semesterUtils";
import { useComponentContext } from "@/contexts/ComponentContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, UserX, BookOpen, Info, Eye, FileSpreadsheet, Table2, Mail, Loader2, Lightbulb, HelpCircle, Target, ExternalLink, Link2, ImageIcon, Users, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wand2, Filter, ListChecks } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

// Converte valor numérico para rótulo descritivo
function valueToLabel(value: number, _gender: "fem" | "masc"): string {
  return value.toFixed(2);
}

export default function ResultsPage() {
  return <ResultsContent />;
}

function ResultsContent() {
  const {
    selectedComponentId, selectedComponentFullLabel,
    selectedClassId, selectedClassCode,
    selectedSemester,
    selectedProblemNumber, selectedSessionId: globalSessionId,
  } = useComponentContext();

  // Sessions for selected class (only finished sessions for results)
  const { data: allSessionsForClass, isLoading: sessionsLoading } = trpc.results.sessionsForClass.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const activeSessions = allSessionsForClass?.filter(s => s.status === "finished") ?? [];
  const activeSessionsLoading = sessionsLoading;

  // Use global session/problem from context; local state only for UI overrides within this page
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => globalSessionId ? String(globalSessionId) : "");
  const [selectedProblem, setSelectedProblem] = useState<string>(() => selectedProblemNumber ? String(selectedProblemNumber) : "");
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);
  const [brainstormExpanded, setBrainstormExpanded] = useState(false);

  // Sync with global context when it changes
  useEffect(() => {
    if (globalSessionId) setSelectedSessionId(String(globalSessionId));
  }, [globalSessionId]);
  useEffect(() => {
    if (selectedProblemNumber) setSelectedProblem(String(selectedProblemNumber));
  }, [selectedProblemNumber]);

  // Auto-select last session when sessions load
  useEffect(() => {
    if (activeSessions && activeSessions.length > 0 && !selectedSessionId) {
      const lastSession = activeSessions[activeSessions.length - 1];
      setSelectedSessionId(String(lastSession.id));
    }
  }, [activeSessions]);

  // Derive unique problem numbers from finished sessions
  const problems = useMemo(() => {
    if (!activeSessions) return [];
    const pSet = new Set(activeSessions.map(s => s.problemNumber));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [activeSessions]);

  // Auto-select last problem when problems list is derived
  useEffect(() => {
    if (problems && problems.length > 0 && !selectedProblem) {
      setSelectedProblem(String(problems[problems.length - 1]));
    }
  }, [problems]);

  // Peer results
  const { data: sessionResults } = trpc.results.session.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Detect if selected session is closed (not yet finished)
  const selectedSession = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
  const isSessionClosed = selectedSession?.status === "closed";

  // Final grades (with tutorial evaluation)
  // Use provisional=true for closed sessions (no tutorial eval yet) to show estimated grades
  const { data: finalResults, isLoading: finalLoading } = trpc.results.sessionFinal.useQuery(
    { sessionId: parseInt(selectedSessionId), provisional: isSessionClosed },
    { enabled: !!selectedSessionId }
  );

  // Tutorial evaluation info
  const { data: tutorialEval } = trpc.tutorialEval.get.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Peer grades matrix (individual grades from each evaluator)
  // Use provisional=true for closed sessions to show default Excelente grades when no evaluations submitted
  const { data: peerMatrix, isLoading: peerMatrixLoading } = trpc.results.peerGradesMatrix.useQuery(
    { sessionId: parseInt(selectedSessionId), provisional: isSessionClosed },
    { enabled: !!selectedSessionId }
  );

  // Brainstorm board data
  const { data: brainstormBoard } = trpc.brainstorm.getBoard.useQuery(
    { sessionId: parseInt(selectedSessionId) },
    { enabled: !!selectedSessionId }
  );

  // Problem-level results
  const { data: problemFinalResults, isLoading: problemFinalLoading } = trpc.results.problemFinal.useQuery(
    { classId: selectedClassId!, problemNumber: parseInt(selectedProblem) },
    { enabled: !!selectedProblem && !!selectedClassId }
  );

  if (!selectedComponentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Selecione um Componente</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Selecione um componente no menu lateral para ver os resultados.
        </p>
      </div>
    );
  }

  // ─── Export helpers ───

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Export session results: tutor eval per item + peer avg + final grade
  const exportSessionResults = () => {
    if (!finalResults) return;
    const session = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    const sessionLabel = session?.label || "sessao";
    const presentCount = finalResults.filter(r => !r.absent && r.peerScore > 0).length;

    const lines: string[] = [];

    // Header section: Session info
    lines.push(`Sessão Tutorial: ${escapeCSV(sessionLabel)}`);
    lines.push(`Problema: ${session?.problemNumber ?? ""},Sessão: ${session?.sessionNumber ?? ""}`);
    lines.push("");

    // Tutorial evaluation section
    if (tutorialEval) {
      lines.push("AVALIAÇÃO DO TUTORIAL PELO PROFESSOR");
      lines.push("Critério,Nota (0-1),Peso,Contribuição");
      lines.push(`Organização,${Number(tutorialEval.organizacao).toFixed(2)},1,${(Number(tutorialEval.organizacao) * 1).toFixed(2)}`);
      lines.push(`Cooperação,${Number(tutorialEval.cooperacao).toFixed(2)},1,${(Number(tutorialEval.cooperacao) * 1).toFixed(2)}`);
      lines.push(`Discussão,${Number(tutorialEval.conteudo).toFixed(2)},3,${(Number(tutorialEval.conteudo) * 3).toFixed(2)}`);
      lines.push(`Progresso,${Number(tutorialEval.objetivo).toFixed(2)},3,${(Number(tutorialEval.objetivo) * 3).toFixed(2)}`);
      lines.push(`Metas,${Number(tutorialEval.metas).toFixed(2)},2,${(Number(tutorialEval.metas) * 2).toFixed(2)}`);
      lines.push(`Nota do Tutorial,,,"${tutorialEval.tutorialGrade.toFixed(1)}"`);
      lines.push(`Alunos Presentes,,,${presentCount}`);
      lines.push(`Pontuação Total,,,"${(tutorialEval.tutorialGrade * presentCount).toFixed(1)}"`);
      lines.push("");
    } else {
      lines.push("AVALIAÇÃO DO TUTORIAL: Pendente");
      lines.push("");
    }

    // Peer evaluation criteria info
    lines.push("CRITÉRIOS DA AVALIAÇÃO ENTRE PARES");
    lines.push("Critério,Peso,Escala");
    lines.push("Pontualidade,×1,0 a 1");
    lines.push("Pesquisa/Metas,×3,0 a 1");
    lines.push("Domínio do Assunto,×3,0 a 1");
    lines.push("Participação,×3,0 a 1");
    lines.push("Desempenho no Papel,−1 (penalidade),0 a 1");
    lines.push("Nota máxima,,10");
    lines.push("");

    // Results table
    const isProvisional = isSessionClosed && !tutorialEval;
    lines.push("RESULTADOS DOS ALUNOS" + (isProvisional ? " (NOTAS PROVISÓRIAS)" : ""));
    if (isProvisional) lines.push("ATENÇÃO: Notas provisórias calculadas com tutorial máximo (10.0). Avalie o tutorial para confirmar.");
    lines.push(`Aluno,Papel,${isProvisional ? "Nota Provisória" : "Nota Final"},Status`);
    for (const r of finalResults) {
      const status = r.absent ? "Faltou" : "Presente";
      lines.push(`${escapeCSV(r.studentName)},${r.role},${r.finalGrade.toFixed(1)},${status}`);
    }

    // Brainstorm board section
    if (brainstormBoard && !(brainstormBoard as any).noBoard && (brainstormBoard as any).items?.length > 0) {
      const boardItems = (brainstormBoard as any).items as BrainstormItemResult[];
      lines.push("");
      lines.push("QUADRO DE BRAINSTORMING");
      const sectionLabels: Record<string, string> = { ideias: "Ideias", fatos: "Fatos", questoes: "Questões", metas: "Metas" };
      const statusLabels: Record<string, string> = {
        analise: "Análise", aceita: "Aceita", descartada: "Descartada",
        verificar: "Verificar", confirmado: "Confirmado", inexato: "Inexato",
        duvida: "Dúvida", investigacao: "Investigação", respondida: "Respondida",
        planejada: "Planejada", em_andamento: "Em Andamento", concluida: "Concluída",
      };
      lines.push("Seção,Conteúdo,Status,Anexo");
      for (const section of ["ideias", "fatos", "questoes", "metas"]) {
        const sectionItems = boardItems.filter(i => i.section === section).sort((a, b) => a.sortOrder - b.sortOrder);
        for (const item of sectionItems) {
          lines.push(`${sectionLabels[section] || section},${escapeCSV(item.content)},${statusLabels[item.status] || item.status},${item.attachmentUrl ? escapeCSV(item.attachmentUrl) : ""}`);
        }
      }
    }

    downloadCSV(lines.join("\n"), `resultados_${sessionLabel.replace(/\s/g, "_")}.csv`);
  };

  // Export problem results: all sessions summary
  const exportProblemResults = () => {
    if (!problemFinalResults) return;
    const sessionsForProblem = activeSessions?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber) ?? [];

    const lines: string[] = [];

    lines.push(`Resultados Consolidados - Problema ${selectedProblem}`);
    lines.push("");

    // Header row — sem colunas de pares; indicar sessões provisórias
    const hasProvisional = sessionsForProblem.some(s => s.status === "closed");
    if (hasProvisional) {
      lines.push("ATENÇÃO: Sessões marcadas com (P) contêm notas provisórias.");
      lines.push("");
    }
    const headers = ["Aluno"];
    for (const s of sessionsForProblem) {
      const label = s.status === "closed" ? `S${s.sessionNumber} (P)` : `S${s.sessionNumber}`;
      headers.push(label);
    }
    headers.push("Média Final");
    lines.push(headers.join(","));

    // Data rows
    for (const r of problemFinalResults) {
      const row = [escapeCSV(r.studentName)];
      for (let idx = 0; idx < sessionsForProblem.length; idx++) {
        row.push((r.finalGrades[idx] ?? 0).toFixed(1));
      }
      row.push(r.finalAverage.toFixed(1));
      lines.push(row.join(","));
    }

    downloadCSV(lines.join("\n"), `resultados_problema_${selectedProblem}.csv`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Resultados
          {selectedComponentFullLabel && <span className="text-primary"> — {selectedComponentFullLabel}{selectedClassCode ? ` — ${selectedClassCode}` : ""}{selectedSemester ? ` — ${selectedSemester}` : ""}</span>}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Visualize e exporte as notas calculadas automaticamente.</p>
      </div>

      <Tabs defaultValue="session" className="space-y-4">
        <TabsList>
          <TabsTrigger value="session">Por Sessão</TabsTrigger>
          <TabsTrigger value="problem">Por Problema</TabsTrigger>
          <TabsTrigger value="consolidated">Consolidado por Aluno</TabsTrigger>
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportSessionResults}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
                <SendGradeEmailsButton sessionId={parseInt(selectedSessionId)} hasTutorialEval={!!tutorialEval} />
              </div>
            )}
          </div>

          {selectedSessionId && (
            <>
              {/* ─── Brainstorm Board ─── (colapsável) */}
              {brainstormBoard && !(brainstormBoard as any).noBoard && (brainstormBoard as any).items?.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 rounded-t-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => setBrainstormExpanded(v => !v)}
                  >
                    <span className="flex items-center gap-2 font-semibold text-amber-800">
                      <Lightbulb className="h-5 w-5" />
                      Quadro de Brainstorming
                    </span>
                    {brainstormExpanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
                  </button>
                  {brainstormExpanded && (
                    <div className="border border-t-0 border-amber-200 rounded-b-lg overflow-hidden">
                      <BrainstormResultsCard items={(brainstormBoard as any).items} />
                    </div>
                  )}
                </div>
              )}

              {/* Peer evaluation criteria info - colapsável */}
              <Card className="bg-emerald-50/50 border-emerald-200">
                <CardHeader
                  className="pb-3 cursor-pointer select-none"
                  onClick={() => setCriteriaExpanded(v => !v)}
                >
                  <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Critérios da Avaliação entre Pares
                    </span>
                    {criteriaExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className={`pt-0 ${criteriaExpanded ? "" : "hidden"}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-emerald-200 text-left">
                          <th className="pb-2 pr-4 font-medium text-emerald-700">Critério</th>
                          <th className="pb-2 pr-4 font-medium text-emerald-700 text-center">Peso</th>
                          <th className="pb-2 font-medium text-emerald-700 text-center">Contribuição Máx.</th>
                        </tr>
                      </thead>
                      <tbody className="text-emerald-900">
                        <tr className="border-b border-emerald-100">
                          <td className="py-1.5 pr-4">Pontualidade</td>
                          <td className="py-1.5 pr-4 text-center">×1</td>
                          <td className="py-1.5 text-center">1,0</td>
                        </tr>
                        <tr className="border-b border-emerald-100">
                          <td className="py-1.5 pr-4">Pesquisa / Metas</td>
                          <td className="py-1.5 pr-4 text-center">×3</td>
                          <td className="py-1.5 text-center">3,0</td>
                        </tr>
                        <tr className="border-b border-emerald-100">
                          <td className="py-1.5 pr-4">Domínio do Assunto</td>
                          <td className="py-1.5 pr-4 text-center">×3</td>
                          <td className="py-1.5 text-center">3,0</td>
                        </tr>
                        <tr className="border-b border-emerald-100">
                          <td className="py-1.5 pr-4">Participação</td>
                          <td className="py-1.5 pr-4 text-center">×3</td>
                          <td className="py-1.5 text-center">3,0</td>
                        </tr>
                        <tr className="border-b border-emerald-100">
                          <td className="py-1.5 pr-4 text-red-700">Desempenho no Papel</td>
                          <td className="py-1.5 pr-4 text-center text-red-700">−1</td>
                          <td className="py-1.5 text-center text-red-700">-1,0</td>
                        </tr>
                        <tr className="font-semibold">
                          <td className="py-2 pr-4" colSpan={2}>Nota Máxima</td>
                          <td className="py-2 text-center text-base">10,0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Tutorial evaluation info */}
              {tutorialEval ? (
                <Card className="bg-blue-50/50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Avaliação do Tutorial pelo Professor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-blue-200 text-left">
                            <th className="pb-2 pr-4 font-medium text-blue-700">Critério</th>
                            <th className="pb-2 pr-4 font-medium text-blue-700 text-center">Nota</th>
                            <th className="pb-2 pr-4 font-medium text-blue-700 text-center">Peso</th>
                            <th className="pb-2 font-medium text-blue-700 text-center">Pontuação</th>
                          </tr>
                        </thead>
                        <tbody className="text-blue-900">
                          {[
                            { label: "Organização", value: Number(tutorialEval.organizacao), weight: 1 },
                            { label: "Cooperação", value: Number(tutorialEval.cooperacao), weight: 1 },
                            { label: "Discussão", value: Number(tutorialEval.conteudo), weight: 3 },
                            { label: "Progresso", value: Number(tutorialEval.objetivo), weight: 3 },
                            { label: "Metas", value: Number(tutorialEval.metas), weight: 2 },
                          ].map((c) => (
                            <tr key={c.label} className="border-b border-blue-100">
                              <td className="py-1.5 pr-4">{c.label}</td>
                              <td className={`py-1.5 pr-4 text-center font-medium ${c.value <= 0 ? "text-red-600" : c.value <= 0.25 ? "text-orange-600" : c.value <= 0.5 ? "text-amber-600" : c.value <= 0.75 ? "text-lime-600" : "text-emerald-600"}`}>{c.value.toFixed(2)}</td>
                              <td className="py-1.5 pr-4 text-center">×{c.weight}</td>
                              <td className="py-1.5 text-center font-medium">{(c.value * c.weight).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="font-semibold border-t border-blue-300">
                            <td className="py-2 pr-4" colSpan={3}>Nota do Tutorial</td>
                            <td className="py-2 text-center text-base">{tutorialEval.tutorialGrade.toFixed(1)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700 flex gap-6">
                      <span>Alunos presentes: <strong>{finalResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0}</strong></span>
                      <span>Pontuação total: <strong>{((tutorialEval.tutorialGrade) * (finalResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0)).toFixed(1)}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>O professor ainda não avaliou esta sessão tutorial. A nota final será calculada após a avaliação do tutorial.</p>
                </div>
              )}

              {/* ─── Peer Grades Matrix ─── */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Table2 className="h-5 w-5" />
                    Notas Individuais dos Pares
                  </CardTitle>
                  <CardDescription>
                    Tabela detalhada com as notas que cada aluno recebeu de cada avaliador. Colunas identificadas pelo número serial do avaliador.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {peerMatrixLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                  ) : !peerMatrix || peerMatrix.rows.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma avaliação entre pares encontrada para esta sessão.</p>
                  ) : (
                    <TooltipProvider>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-3 pr-3 font-semibold text-center w-12">Nº</th>
                              <th className="pb-3 pr-3 font-semibold">Matrícula</th>
                              <th className="pb-3 pr-3 font-semibold">Nome</th>
                              {peerMatrix.evaluators.map(ev => (
                                <th key={ev.studentId} className="pb-3 px-1 font-semibold text-center min-w-[48px]">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50">
                                        A{ev.serial}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs"><strong>{ev.name}</strong></p>
                                      <p className="text-xs text-muted-foreground">{ev.enrollment}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </th>
                              ))}
                              <th className="pb-3 pl-2 font-semibold text-center">Média Pares</th>
                            </tr>
                          </thead>
                          <tbody>
                            {peerMatrix.rows.map((row) => (
                              <tr key={row.studentId} className={`border-b last:border-0 transition-colors ${row.absent ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-accent/20"}`}>
                                <td className="py-2.5 pr-3 text-center text-muted-foreground font-medium">{row.serial}</td>
                                <td className="py-2.5 pr-3 font-mono text-xs">{row.studentEnrollment}</td>
                                <td className="py-2.5 pr-3">
                                  <span className="font-medium">{row.studentName}</span>
                                  {row.absent && (
                                    <Badge variant="outline" className="ml-2 bg-red-50 text-red-600 border-red-200 text-[10px] py-0">
                                      Faltou
                                    </Badge>
                                  )}
                                </td>
                                {peerMatrix.evaluators.map(ev => {
                                  if (row.absent && row.peerGrades.length === 0) {
                                    return (
                                      <td key={ev.studentId} className="py-2.5 px-1 text-center">
                                        <span className="text-red-400 italic font-medium">F</span>
                                      </td>
                                    );
                                  }
                                  if (ev.studentId === row.studentId) {
                                    return (
                                      <td key={ev.studentId} className="py-2.5 px-1 text-center">
                                        <span className="text-muted-foreground/40">—</span>
                                      </td>
                                    );
                                  }
                                  const grade = row.peerGrades.find(g => g.evaluatorStudentId === ev.studentId);
                                  if (!grade) {
                                    return (
                                      <td key={ev.studentId} className="py-2.5 px-1 text-center">
                                        <span className="text-muted-foreground/30">-</span>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={ev.studentId} className="py-2.5 px-1 text-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`text-sm cursor-default ${
                                            grade.absent ? "text-red-400 italic" :
                                            grade.autoFilled ? "text-amber-500 font-medium" :
                                            grade.score >= 8 ? "text-emerald-600 font-medium" :
                                            grade.score >= 5 ? "text-amber-600" :
                                            "text-red-600"
                                          }`}>
                                            {grade.absent ? "F" : grade.score.toFixed(1)}
                                            {grade.autoFilled && !grade.absent && (
                                              <Wand2 className="inline h-2.5 w-2.5 ml-0.5 mb-0.5 opacity-70" />
                                            )}
                                          </span>
                                        </TooltipTrigger>
                                        {grade.autoFilled && !grade.absent && (
                                          <TooltipContent side="top">
                                            <p className="text-xs">Preenchido automaticamente (aluno não submeteu avaliação)</p>
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 pl-2 text-center">
                                  {row.absent ? (
                                    <span className="text-red-400 italic font-medium">F</span>
                                  ) : (
                                    <span className={`font-bold ${
                                      row.peerAverage >= 8 ? "text-emerald-600" :
                                      row.peerAverage >= 5 ? "text-amber-600" :
                                      "text-red-600"
                                    }`}>
                                      {row.peerAverage.toFixed(1)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 pt-3 border-t text-xs text-muted-foreground space-y-1">
                        <p><strong>Legenda:</strong> A1, A2, ... = Número serial do avaliador (passe o mouse para ver o nome). <strong>—</strong> = Autoavaliação (excluída). <strong>F</strong> = Faltou. <strong>-</strong> = Sem avaliação. <Wand2 className="inline h-3 w-3 mx-0.5" /> = Preenchido automaticamente.</p>
                      </div>
                    </TooltipProvider>
                  )}
                </CardContent>
              </Card>

              {/* ─── Notas Finais da Sessão ─── */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Notas Finais da Sessão
                  </CardTitle>
                  <CardDescription>
                    {tutorialEval
                      ? "Notas finais calculadas com distribuição proporcional baseada na avaliação do tutorial."
                      : isSessionClosed
                        ? "Sessão fechada — notas provisórias baseadas na avaliação dos pares (assumindo tutorial máximo). Avalie o tutorial para calcular as notas finais."
                        : "Mostrando apenas notas da avaliação pelos pares. Avalie o tutorial para ver as notas finais."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {finalLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                  ) : !finalResults || finalResults.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma avaliação encontrada para esta sessão.</p>
                  ) : (() => {
                    return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-4 font-semibold w-12">#</th>
                            <th className="pb-3 pr-4 font-semibold">Aluno</th>
                            <th className="pb-3 pr-4 font-semibold">Papel</th>
                            <th className="pb-3 pr-4 font-semibold text-center">Média Pares</th>
                            {(tutorialEval || isSessionClosed) && <th className="pb-3 pr-4 font-semibold text-center">{isSessionClosed && !tutorialEval ? "Nota Provisória" : "Nota Final"}</th>}
                            <th className="pb-3 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finalResults.map((r, i) => (
                            <tr key={r.studentId} className={`border-b last:border-0 transition-colors ${r.absent ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-accent/20"}`}>
                              <td className="py-3 pr-4">
                                <span className="text-muted-foreground">{i + 1}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <p className={`font-medium ${r.absent ? "text-red-400" : ""}`}>{r.studentName}</p>
                              </td>
                              <td className="py-3 pr-4">
                                <RoleBadge role={r.role} />
                              </td>
                              <td className="py-3 pr-4 text-center">
                                <span className={`font-medium ${r.absent ? "text-muted-foreground" : r.peerScore >= 8 ? "text-emerald-600" : r.peerScore >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                  {r.peerScore.toFixed(1)}
                                </span>
                              </td>
                              {(tutorialEval || isSessionClosed) && (
                                <td className="py-3 pr-4 text-center">
                                  <span className={`font-medium inline-flex items-center gap-1 ${r.absent ? "text-muted-foreground" : r.finalGrade >= 8 ? "text-emerald-600" : r.finalGrade >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                    {r.finalGrade.toFixed(1)}
                                    {(r as { provisional?: boolean }).provisional && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Info className="h-3.5 w-3.5 text-blue-400 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Nota provisória — calculada assumindo avaliação tutorial máxima. Sujeita a alteração após avaliação do tutor.</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {(r as { capped?: boolean }).capped && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Nota arredondada para 10.0 (nota calculada era superior)</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </span>
                                </td>
                              )}
                              <td className="py-3 text-center">
                                {r.absent ? (
                                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                                    <UserX className="h-3 w-3 mr-1" />Faltou
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                                    Presente
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    );
                  })()}
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
              <Button variant="outline" size="sm" onClick={exportProblemResults}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
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
                {problemFinalLoading ? (
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
                            <th key={s.id} className="pb-3 pr-2 font-semibold text-center text-xs">
                              <div className="flex flex-col items-center gap-0.5">
                                <span>S{s.sessionNumber}</span>
                                {s.status === "closed" && (
                                  <span className="text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-tight">Prov.</span>
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="pb-3 pr-2 font-semibold text-center">Média Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemFinalResults.map((r, i) => (
                          <tr key={r.studentId} className={`border-b last:border-0 transition-colors ${
                            (r as any).excludedFlags?.some(Boolean) ? "bg-orange-50/30 hover:bg-orange-50/50" :
                            r.finalAverage === 0 && r.peerAverage === 0 ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-accent/20"
                          }`}>
                            <td className="py-3 pr-4">
                              <span className="text-muted-foreground">{i + 1}</span>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-medium ${
                                  (r as any).excludedFlags?.some(Boolean) ? "text-orange-400 line-through" : ""
                                }`}>{r.studentName}</p>
                                {(r as any).excludedFlags?.some(Boolean) && (
                                  <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-500 border-orange-200 px-1 py-0">Excluído</Badge>
                                )}
                              </div>
                            </td>
                            {r.finalGrades.map((finalGrade, idx) => {
                              const isExcluded = (r as any).excludedFlags?.[idx] === true;
                              return (
                                <td key={idx} className="py-3 pr-2 text-center">
                                  {isExcluded ? (
                                    <span className="text-muted-foreground/40">—</span>
                                  ) : (
                                    <span className={finalGrade === 0 ? "text-muted-foreground" : "text-sm font-medium"}>
                                      {(finalGrade as number)?.toFixed(1) ?? "0.0"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-3 pr-2 text-center">
                              {(r as any).excludedFlags?.every(Boolean) ? (
                                <span className="text-muted-foreground/40">—</span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className={`font-bold ${r.finalAverage >= 8 ? "text-emerald-600" : r.finalAverage >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                    {r.finalAverage.toFixed(1)}
                                  </span>
                                  {(r as any).finalAverageCapped && (
                                    <span title="Nota arredondada para 10.0" className="text-amber-500 cursor-help" style={{fontSize: '0.75rem'}}>★</span>
                                  )}
                                </span>
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
          )}
        </TabsContent>

        {/* ─── Consolidated Student Report ─── */}
        <TabsContent value="consolidated" className="space-y-4">
          <ConsolidatedStudentReport classId={selectedClassId!} />
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

function SendGradeEmailsButton({ sessionId, hasTutorialEval }: { sessionId: number; hasTutorialEval: boolean }) {
  const [sending, setSending] = useState(false);
  const sendMutation = trpc.results.sendGradeEmails.useMutation({
    onSuccess: (result) => {
      setSending(false);
      if (result.failed === 0) {
        toast.success(`Relatórios enviados com sucesso para ${result.sent} aluno(s)!`);
      } else {
        toast.warning(
          `Enviados: ${result.sent}/${result.total}. Falhas: ${result.failed}. ${result.errors.slice(0, 3).join("; ")}`,
          { duration: 8000 }
        );
      }
    },
    onError: (e) => {
      setSending(false);
      toast.error(e.message);
    },
  });

  const handleSend = () => {
    if (!hasTutorialEval) {
      toast.error("A avaliação do tutorial precisa ser finalizada antes de enviar as notas.");
      return;
    }
    if (!confirm("Deseja enviar o relatório de notas por e-mail para todos os alunos desta sessão?")) return;
    setSending(true);
    sendMutation.mutate({ sessionId });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={sending || sendMutation.isPending || !hasTutorialEval}
      title={!hasTutorialEval ? "Finalize a avaliação do tutorial primeiro" : "Enviar relatório de notas por e-mail"}
    >
      {sending || sendMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Mail className="h-4 w-4 mr-2" />
      )}
      Enviar Notas por E-mail
    </Button>
  );
}

const BRAINSTORM_SECTIONS: Record<string, {
  label: string;
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: Record<string, { label: string; color: string }>;
}> = {
  ideias: {
    label: "Ideias",
    icon: Lightbulb,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    statuses: {
      analise: { label: "Análise", color: "bg-amber-100 text-amber-800" },
      aceita: { label: "Aceita", color: "bg-emerald-100 text-emerald-800" },
      descartada: { label: "Descartada", color: "bg-red-100 text-red-800" },
    },
  },
  fatos: {
    label: "Fatos",
    icon: BookOpen,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    statuses: {
      verificar: { label: "Verificar", color: "bg-blue-100 text-blue-800" },
      confirmado: { label: "Confirmado", color: "bg-emerald-100 text-emerald-800" },
      inexato: { label: "Inexato", color: "bg-red-100 text-red-800" },
    },
  },
  questoes: {
    label: "Questões",
    icon: HelpCircle,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    statuses: {
      duvida: { label: "Dúvida", color: "bg-purple-100 text-purple-800" },
      investigacao: { label: "Investigação", color: "bg-orange-100 text-orange-800" },
      respondida: { label: "Respondida", color: "bg-emerald-100 text-emerald-800" },
    },
  },
  metas: {
    label: "Metas",
    icon: Target,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    statuses: {
      planejada: { label: "Planejada", color: "bg-slate-100 text-slate-800" },
      em_andamento: { label: "Em Andamento", color: "bg-orange-100 text-orange-800" },
      concluida: { label: "Concluída", color: "bg-emerald-100 text-emerald-800" },
    },
  },
};

interface BrainstormItemResult {
  id: number;
  section: string;
  content: string;
  status: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  sortOrder: number;
}

function BrainstormResultsCard({ items }: { items: BrainstormItemResult[] }) {
  const sections = ["ideias", "fatos", "questoes", "metas"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-600" />
          Quadro de Brainstorming
        </CardTitle>
        <CardDescription>
          Registro das ideias, fatos, questões e metas discutidas durante a sessão tutorial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((sectionKey) => {
            const config = BRAINSTORM_SECTIONS[sectionKey];
            const sectionItems = items
              .filter((item) => item.section === sectionKey)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const Icon = config.icon;

            return (
              <div
                key={sectionKey}
                className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
              >
                <h4 className={`font-semibold text-sm mb-3 flex items-center gap-2 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                  {config.label}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {sectionItems.length}
                  </Badge>
                </h4>
                {sectionItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum item registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {sectionItems.map((item) => {
                      const statusInfo = config.statuses[item.status] || { label: item.status, color: "bg-gray-100 text-gray-700" };
                      return (
                        <li key={item.id} className="bg-white/80 rounded-md p-2.5 border border-white/60 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm flex-1 break-words">{item.content}</p>
                            <Badge className={`text-[10px] shrink-0 ${statusInfo.color}`}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          {item.attachmentUrl && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {item.attachmentType === "image" || item.attachmentType === "photo" ? (
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  Ver imagem
                                </a>
                              ) : item.attachmentType === "video" ? (
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Ver vídeo
                                </a>
                              ) : (
                                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                  <Link2 className="h-3 w-3" />
                                  Abrir link
                                </a>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsolidatedStudentReport({ classId }: { classId: number }) {
  const { data: report, isLoading } = trpc.results.studentConsolidated.useQuery(
    { classId },
    { enabled: !!classId }
  );

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportConsolidated = () => {
    if (!report || report.length === 0) return;
    const sessions = report[0].sessions;
    const hasProvisionalSessions = sessions.some(s => s.status === "closed");
    const sessionHeaders = sessions.map(s => {
      const abbr = `P${s.problemNumber}S${s.sessionNumber}`;
      return s.status === "closed" ? `${abbr} (P)` : abbr;
    });
    const header = ["Matrícula", "Aluno", ...sessionHeaders, "Presenças", "Faltas", "Média Final"];
    const extraLines: string[] = [];
    if (hasProvisionalSessions) {
      extraLines.push("ATENÇÃO: Colunas marcadas com (P) contêm notas provisórias (sessão fechada aguardando avaliação do tutorial).");
      extraLines.push("");
    }
    const rows = report.map(r => [
      escapeCSV(r.studentEnrollment),
      escapeCSV(r.studentName),
      ...r.sessions.map(s => s.finalGrade.toFixed(1)),
      r.presentCount,
      r.absentCount,
      r.avgFinalGrade.toFixed(1),
    ]);
    const csv = [...extraLines, header.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadCSV(csv, `relatorio_consolidado_turma_${classId}.csv`);
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  if (!report || report.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum dado disponível. Crie sessões e realize avaliações para ver o relatório consolidado.</p>
        </CardContent>
      </Card>
    );
  }

  const sessions = report[0].sessions;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Relatório Consolidado por Aluno
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral de todas as sessões do semestre, com notas e presenças acumuladas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportConsolidated}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="py-3 px-3 font-semibold sticky left-0 bg-muted/30 z-10">#</th>
                  <th className="py-3 px-3 font-semibold sticky left-8 bg-muted/30 z-10 min-w-[180px]">Aluno</th>
                  <th className="py-3 px-2 font-semibold text-center min-w-[60px]">Matrícula</th>
                  {sessions.map((s, i) => (
                    <th key={i} className="py-3 px-2 font-semibold text-center min-w-[70px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs">P{s.problemNumber}S{s.sessionNumber}</span>
                        {s.status === "closed" && (
                          <span className="text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-tight">Prov.</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-2 font-semibold text-center bg-emerald-50/50">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span className="text-xs">Presenças</span>
                    </div>
                  </th>
                  <th className="py-3 px-2 font-semibold text-center bg-red-50/50">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-xs">Faltas</span>
                    </div>
                  </th>
                  <th className="py-3 px-2 font-semibold text-center bg-amber-50/50">
                    <span className="text-xs font-bold">Média Final</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.map((student, idx) => (
                  <tr
                    key={student.studentId}
                    className={`border-b last:border-0 transition-colors ${
                      (student as any).allExcluded
                        ? "bg-orange-50/40 hover:bg-orange-50/60"
                        : student.absentCount === student.totalSessions - ((student as any).excludedCount ?? 0)
                        ? "bg-red-50/60 hover:bg-red-50"
                        : student.absentCount > 0
                        ? "hover:bg-amber-50/30"
                        : "hover:bg-accent/20"
                    }`}
                  >
                    <td className="py-2.5 px-3 text-muted-foreground sticky left-0 bg-background z-10">{idx + 1}</td>
                    <td className="py-2.5 px-3 sticky left-8 bg-background z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`font-medium text-sm ${
                          ((student as any).excludedCount ?? 0) > 0 ? "text-orange-400 line-through" :
                          student.absentCount === student.totalSessions - ((student as any).excludedCount ?? 0) ? "text-red-400 line-through" : ""
                        }`}>
                          {student.studentName}
                        </p>
                        {((student as any).excludedCount ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-500 border-orange-200 px-1 py-0">Excluído</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs font-mono text-muted-foreground">
                      {student.studentEnrollment}
                    </td>
                    {student.sessions.map((s, i) => (
                      <td key={i} className="py-2.5 px-2 text-center">
                        {(s as any).excluded ? (
                          <div className="flex flex-col items-center">
                            <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-500 border-orange-200 px-1">
                              <UserX className="h-2.5 w-2.5 mr-0.5" />E
                            </Badge>
                          </div>
                        ) : s.absent ? (
                          <div className="flex flex-col items-center">
                            <Badge variant="outline" className="text-[9px] bg-red-50 text-red-500 border-red-200 px-1">
                              <UserX className="h-2.5 w-2.5 mr-0.5" />F
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-medium ${
                              s.finalGrade >= 8 ? "text-emerald-600" : s.finalGrade >= 5 ? "text-amber-600" : s.finalGrade > 0 ? "text-red-600" : "text-muted-foreground"
                            }`}>
                              {s.finalGrade > 0 ? s.finalGrade.toFixed(1) : "—"}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{s.role.substring(0, 4)}</span>
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-2 text-center bg-emerald-50/30">
                      {(student as any).allExcluded ? (
                        <span className="font-medium text-orange-400">—</span>
                      ) : (
                        <>
                          <span className="font-medium text-emerald-700">{student.presentCount}</span>
                          <span className="text-muted-foreground text-xs">/{student.totalSessions - ((student as any).excludedCount ?? 0)}</span>
                        </>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center bg-red-50/30">
                      {(student as any).allExcluded ? (
                        <span className="font-medium text-orange-400">—</span>
                      ) : (
                        <span className={`font-medium ${student.absentCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {student.absentCount}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center bg-amber-50/30">
                      {(student as any).allExcluded ? (
                        <span className="font-bold text-orange-500 italic">E</span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1">
                          <span className={`font-bold ${
                            student.avgFinalGrade >= 8 ? "text-emerald-600" : student.avgFinalGrade >= 5 ? "text-amber-600" : student.avgFinalGrade > 0 ? "text-red-600" : "text-muted-foreground"
                          }`}>
                            {student.avgFinalGrade > 0 ? student.avgFinalGrade.toFixed(1) : "—"}
                          </span>
                          {(student as any).avgFinalCapped && (
                            <span title="Nota arredondada para 10.0" className="text-amber-500 cursor-help" style={{fontSize: '0.75rem'}}>★</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
