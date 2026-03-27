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
import { BarChart3, Download, UserX, BookOpen, Info, Eye, FileSpreadsheet, Table2, Mail, Loader2, Lightbulb, HelpCircle, Target, ExternalLink, Link2, ImageIcon, Users, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wand2, Filter, ListChecks, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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

  // Sessions for selected class (all sessions — initiated, open, closed, finished)
  const { data: allSessionsForClass, isLoading: sessionsLoading } = trpc.results.sessionsForClass.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );
  const activeSessions = allSessionsForClass ?? [];
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

  // Reset session/problem selection when class changes
  useEffect(() => {
    setSelectedSessionId("");
    setSelectedProblem("");
  }, [selectedClassId]);

  // Auto-select last session when sessions load (or when class changes and sessions reload)
  useEffect(() => {
    if (activeSessions && activeSessions.length > 0) {
      const sorted = [...activeSessions].sort((a, b) =>
        a.problemNumber !== b.problemNumber
          ? a.problemNumber - b.problemNumber
          : a.sessionNumber - b.sessionNumber
      );
      const lastSession = sorted[sorted.length - 1];
      setSelectedSessionId(String(lastSession.id));
    }
  }, [activeSessions]);

  // Derive unique problem numbers from finished sessions
  const problems = useMemo(() => {
    if (!activeSessions) return [];
    const pSet = new Set(activeSessions.map(s => s.problemNumber));
    return Array.from(pSet).sort((a, b) => a - b);
  }, [activeSessions]);

  // Auto-select last problem when problems list is derived (or when class changes)
  useEffect(() => {
    if (problems && problems.length > 0) {
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
  const { data: desempenhoResults, isLoading: desempenhoLoading } = trpc.results.sessionFinal.useQuery(
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
  const { data: problemDesempenhoResults, isLoading: problemDesempenhoLoading } = trpc.results.problemFinal.useQuery(
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

  if (!selectedClassId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhuma turma encontrada</h2>
        <p className="text-muted-foreground text-center max-w-md">
          O componente selecionado não possui turmas cadastradas neste semestre.
        </p>
      </div>
    );
  }

  // ─── Export helpers ───
  const trpcUtils = trpc.useUtils();
  const [exportingAllSession, setExportingAllSession] = React.useState(false);
  const [exportingAllProblem, setExportingAllProblem] = React.useState(false);
  const [exportingAllConsolidated, setExportingAllConsolidated] = React.useState(false);

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
    if (!desempenhoResults) return;
    const csvSession = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    const sessionLabel = csvSession?.label || "sessao";
    const presentCount = desempenhoResults.filter(r => !r.absent && r.peerScore > 0).length;

    const lines: string[] = [];

    // Helper para formatar data da sessão
    const fmtDate = (raw: Date | string | null | undefined) => {
      if (!raw) return '';
      const d = new Date(raw);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const sessionDate = fmtDate(csvSession?.closedAt || csvSession?.createdAt);

    // Header section: Session info
    lines.push(`Sessão Tutorial: ${escapeCSV(sessionLabel)}`);
    lines.push(`Problema: ${csvSession?.problemNumber ?? ""},Sessão: ${csvSession?.sessionNumber ?? ""}`);
    if (sessionDate) lines.push(`Data: ${sessionDate}`);
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
    lines.push(`Aluno,Papel,${isProvisional ? "Nota Desempenho (Provisória)" : "Nota Desempenho"},Status`);
    for (const r of desempenhoResults) {
      const status = r.absent ? "Faltou" : "Presente";
      lines.push(`${escapeCSV(r.studentName)},${r.role},${r.desempenhoScore.toFixed(1)},${status}`);
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
    if (!problemDesempenhoResults) return;
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
    const fmtDateP = (raw: Date | string | null | undefined) => {
      if (!raw) return '';
      const d = new Date(raw);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const headers = ["Aluno"];
    for (const s of sessionsForProblem) {
      const dateStr = fmtDateP(s.closedAt || s.createdAt);
      const provisional = s.status === "closed" ? " (P)" : "";
      const label = `S${s.sessionNumber}${provisional}${dateStr ? ` ${dateStr}` : ''}`;
      headers.push(label);
    }
    headers.push("Média Desempenho");
    lines.push(headers.join(","));

    // Data rows
    for (const r of problemDesempenhoResults) {
      const row = [escapeCSV(r.studentName)];
      for (let idx = 0; idx < sessionsForProblem.length; idx++) {
        row.push((r.desempenhoScores[idx] ?? 0).toFixed(1));
      }
      row.push(r.mediaDesempenho.toFixed(1));
      lines.push(row.join(","));
    }

    downloadCSV(lines.join("\n"), `resultados_problema_${selectedProblem}.csv`);
  };

  // ─── PDF Export helpers ───
  const exportSessionPDF = async () => {
    if (!desempenhoResults) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const pdfSession = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    const sessionLabel = pdfSession?.label || 'Sessão';
    const fmtDatePDF = (raw: Date | string | null | undefined) => {
      if (!raw) return '';
      return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const sessionDatePDF = fmtDatePDF(pdfSession?.closedAt || pdfSession?.createdAt);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(`Resultados - ${sessionLabel}`, 14, 18);
    doc.setFontSize(9);
    const infoLine1 = `Componente: ${selectedComponentFullLabel || ''} | Turma: ${selectedClassCode || ''} | Semestre: ${selectedSemester || ''}`;
    const infoLine2 = sessionDatePDF ? `Data da sessão: ${sessionDatePDF}` : '';
    doc.text(infoLine1, 14, 26);
    let y = 32;
    if (infoLine2) { doc.text(infoLine2, 14, 31); y = 37; }
    if (tutorialEval) {
      doc.setFontSize(10);
      doc.text('Avaliação do Tutorial', 14, y + 4);
      autoTable(doc, {
        startY: y + 7,
        head: [['Critério', 'Nota', 'Peso', 'Contribuição']],
        body: [
          ['Organização', Number(tutorialEval.organizacao).toFixed(2), '1', (Number(tutorialEval.organizacao)*1).toFixed(2)],
          ['Cooperação', Number(tutorialEval.cooperacao).toFixed(2), '1', (Number(tutorialEval.cooperacao)*1).toFixed(2)],
          ['Discussão', Number(tutorialEval.conteudo).toFixed(2), '3', (Number(tutorialEval.conteudo)*3).toFixed(2)],
          ['Progresso', Number(tutorialEval.objetivo).toFixed(2), '3', (Number(tutorialEval.objetivo)*3).toFixed(2)],
          ['Metas', Number(tutorialEval.metas).toFixed(2), '2', (Number(tutorialEval.metas)*2).toFixed(2)],
          ['Nota do Tutorial', tutorialEval.tutorialGrade.toFixed(1), '', ''],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    doc.setFontSize(10);
    doc.text('Resultados dos Alunos', 14, y + 4);
    autoTable(doc, {
      startY: y + 7,
      head: [['Aluno', 'Papel', 'Nota Desempenho', 'Status']],
      body: desempenhoResults.map(r => [r.studentName, r.role, r.desempenhoScore.toFixed(1), r.absent ? 'Faltou' : 'Presente']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    const classCodeNorm = (selectedClassCode || 'tp').toLowerCase().replace(/\s/g, '-');
    const exportSession = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    const pNum = exportSession?.problemNumber ?? 1;
    const sNum = exportSession?.sessionNumber ?? 1;
    doc.save(`desempenho-${classCodeNorm}-p${pNum}-s${sNum}.pdf`);
  };

  const exportProblemPDF = async () => {
    if (!problemDesempenhoResults) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const sessionsForProblem = activeSessions?.filter(s => s.problemNumber === parseInt(selectedProblem)).sort((a, b) => a.sessionNumber - b.sessionNumber) ?? [];
    const fmtDateProbPDF = (raw: Date | string | null | undefined) => {
      if (!raw) return '';
      return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(`Resultados - Problema ${selectedProblem}`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Componente: ${selectedComponentFullLabel || ''} | Turma: ${selectedClassCode || ''} | Semestre: ${selectedSemester || ''}`, 14, 26);
    const headers = ['Aluno', ...sessionsForProblem.map(s => {
      const d = fmtDateProbPDF(s.closedAt || s.createdAt);
      return d ? `S${s.sessionNumber} (${d})` : `S${s.sessionNumber}`;
    }), 'Média Desempenho'];
    const body = problemDesempenhoResults.map(r => [
      r.studentName,
      ...sessionsForProblem.map((_, i) => (r.desempenhoScores[i] ?? 0).toFixed(1)),
      r.mediaDesempenho.toFixed(1),
    ]);
    autoTable(doc, {
      startY: 32,
      head: [headers],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    const classCodeNorm2 = (selectedClassCode || 'tp').toLowerCase().replace(/\s/g, '-');
    doc.save(`desempenho-${classCodeNorm2}-p${selectedProblem}.pdf`);
  };

  // ─── Export All Classes ───
  const exportAllClassesSessionPDF = async () => {
    if (!selectedComponentId || !selectedSemester || !selectedSessionId) return;
    const pdfSession = activeSessions?.find(s => s.id === parseInt(selectedSessionId));
    if (!pdfSession) return;
    setExportingAllSession(true);
    try {
      const allData = await trpcUtils.results.allClassesSessionResults.fetch({
        componentId: selectedComponentId,
        semester: selectedSemester,
        problemNumber: pdfSession.problemNumber,
        sessionNumber: pdfSession.sessionNumber,
      });
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let firstPage = true;
      for (const cls of allData) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        doc.setFontSize(14);
        doc.text(`Turma ${cls.classCode} — P${pdfSession.problemNumber}S${pdfSession.sessionNumber}`, 14, 18);
        doc.setFontSize(9);
        const sessionDateAll = (() => {
          const raw = pdfSession.closedAt || pdfSession.createdAt;
          return raw ? new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        })();
        doc.text(`Componente: ${selectedComponentFullLabel || ''} | Semestre: ${selectedSemester || ''}`, 14, 26);
        if (sessionDateAll) doc.text(`Data da sessão: ${sessionDateAll}`, 14, 31);
        const startYAll = sessionDateAll ? 37 : 32;
        if (cls.desempenhoScores.length === 0) {
          doc.setFontSize(10);
          doc.text('Sessão não encontrada para esta turma.', 14, startYAll + 4);
        } else {
          autoTable(doc, {
            startY: startYAll,
            head: [['Matrícula', 'Papel', 'Nota Desempenho', 'Status']],
            body: cls.desempenhoScores.map((r: any) => [r.studentEnrollment || r.studentName, r.role, r.desempenhoScore.toFixed(1), r.absent ? 'Faltou' : 'Presente']),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            margin: { left: 14, right: 14 },
          });
        }
      }
      doc.save(`desempenho-todas-turmas-p${pdfSession.problemNumber}-s${pdfSession.sessionNumber}.pdf`);
    } catch (e) {
      toast.error('Erro ao exportar todas as turmas');
    } finally {
      setExportingAllSession(false);
    }
  };

  const exportAllClassesProblemPDF = async () => {
    if (!selectedComponentId || !selectedSemester || !selectedProblem) return;
    setExportingAllProblem(true);
    try {
      const allData = await trpcUtils.results.allClassesProblemResults.fetch({
        componentId: selectedComponentId,
        semester: selectedSemester,
        problemNumber: parseInt(selectedProblem),
      });
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let firstPage = true;
      for (const cls of allData) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        doc.setFontSize(14);
        doc.text(`Turma ${cls.classCode} — Problema ${selectedProblem}`, 14, 18);
        doc.setFontSize(9);
        doc.text(`Componente: ${selectedComponentFullLabel || ''} | Semestre: ${selectedSemester || ''}`, 14, 26);
        const headers = ['Matrícula', ...cls.problemSessions.map((s: any) => {
          const raw = s.closedAt || s.createdAt;
          const d = raw ? new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
          return d ? `S${s.sessionNumber} (${d})` : `S${s.sessionNumber}`;
        }), 'Média Desempenho'];
        const body = cls.problemFinal.map((r: any) => [
          r.studentEnrollment || r.studentName,
          ...cls.problemSessions.map((_: any, i: number) => (r.desempenhoScores[i] ?? 0).toFixed(1)),
          r.mediaDesempenho.toFixed(1),
        ]);
        autoTable(doc, {
          startY: 32,
          head: [headers],
          body,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
      }
      doc.save(`desempenho-todas-turmas-p${selectedProblem}.pdf`);
    } catch (e) {
      toast.error('Erro ao exportar todas as turmas');
    } finally {
      setExportingAllProblem(false);
    }
  };

  const exportAllClassesConsolidatedPDF = async () => {
    if (!selectedComponentId || !selectedSemester) return;
    setExportingAllConsolidated(true);
    try {
      const allData = await trpcUtils.results.allClassesConsolidated.fetch({
        componentId: selectedComponentId,
        semester: selectedSemester,
      });
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let firstPage = true;
      for (const cls of allData) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        doc.setFontSize(14);
        doc.text(`Turma ${cls.classCode} — Consolidado`, 14, 18);
        doc.setFontSize(9);
        doc.text(`Componente: ${selectedComponentFullLabel || ''} | Semestre: ${selectedSemester || ''}`, 14, 26);
        if (!cls.report || cls.report.length === 0) {
          doc.setFontSize(10);
          doc.text('Sem dados para esta turma.', 14, 36);
          continue;
        }
        const sessions = cls.report[0].sessions;
        const pNums = Array.from(new Set(sessions.map((s: any) => s.problemNumber))).sort((a: any, b: any) => a - b) as number[];
        const fmtDateCons = (raw: Date | string | null | undefined) => {
          if (!raw) return '';
          return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        const colHeaders: string[] = ['#', 'Matrícula'];
        for (const pNum of pNums) {
          const pSessions = sessions.filter((s: any) => s.problemNumber === pNum);
          pSessions.forEach((s: any) => {
            const d = fmtDateCons(s.closedAt || s.createdAt);
            colHeaders.push(d ? `P${s.problemNumber}S${s.sessionNumber} (${d})` : `P${s.problemNumber}S${s.sessionNumber}`);
          });
          colHeaders.push(`MP${pNum}`);
        }
        colHeaders.push('Faltas', 'Média Desempenho');
        const body = cls.report.map((student: any, idx: number) => {
          const row: string[] = [String(idx + 1), student.studentEnrollment];
          for (const pNum of pNums) {
            const pSessions = sessions.filter((s: any) => s.problemNumber === pNum);
            pSessions.forEach((s: any) => {
              const sIdx = sessions.indexOf(s);
              const sd = student.sessions[sIdx];
              if (!sd) { row.push('—'); return; }
              if (sd.excluded) { row.push('E'); return; }
              if (sd.absent) { row.push('F'); return; }
              row.push(sd.desempenhoScore.toFixed(1));
            });
            const totalCount = pSessions.length;
            const presentSum = student.sessions.filter((s: any) => s.problemNumber === pNum && !s.absent && !s.excluded).reduce((sum: number, s: any) => sum + s.desempenhoScore, 0);
            const avg = totalCount > 0 ? Math.min(10, Math.round(presentSum / totalCount * 10) / 10) : 0;
            row.push(avg.toFixed(1));
          }
          row.push(String(student.absentCount), student.mediaDesempenho.toFixed(1));
          return row;
        });
        autoTable(doc, {
          startY: 32,
          head: [colHeaders],
          body,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 10, right: 10 },
        });
      }
      doc.save(`desempenho-todas-turmas.pdf`);
    } catch (e) {
      toast.error('Erro ao exportar todas as turmas');
    } finally {
      setExportingAllConsolidated(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desempenho"
        componentLabel={selectedComponentFullLabel}
        semester={selectedSemester}
        classCode={selectedClassCode}
      />

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
            {/* Badge de data da sessão selecionada */}
            {selectedSession && (() => {
              const raw = selectedSession.closedAt || selectedSession.createdAt;
              const d = raw ? new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
              return d ? (
                <div className="flex flex-col justify-end pb-0.5">
                  <span className="text-xs text-muted-foreground mb-1">Data</span>
                  <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border bg-muted/40 text-sm font-medium text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {d}
                  </div>
                </div>
              ) : null;
            })()}
            {desempenhoResults && desempenhoResults.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={exportSessionResults}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportSessionPDF}>
                  <FileText className="h-4 w-4 mr-2" />Exportar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportAllClassesSessionPDF} disabled={exportingAllSession}>
                  <FileText className="h-4 w-4 mr-2" />{exportingAllSession ? 'Exportando...' : 'Exportar todas as turmas'}
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
                      <span>Alunos presentes: <strong>{desempenhoResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0}</strong></span>
                      <span>Pontuação total: <strong>{((tutorialEval.tutorialGrade) * (desempenhoResults?.filter(r => !r.absent && r.peerScore > 0).length ?? 0)).toFixed(1)}</strong></span>
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
                    Tabela detalhada com as notas que cada aluno recebeu de cada avaliador. Colunas identificadas pelo número do aluno.
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
                                  if (row.absent) {
                                    return (
                                      <td key={ev.studentId} className="py-2.5 px-1 text-center">
                                        <span className="text-red-400 font-medium">0.0</span>
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
                                             <p className="text-xs">Não enviou (autopreenchida)</p>
                                           </TooltipContent>
                                        )}
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 pl-2 text-center">
                                  {row.absent ? (
                                    <span className="text-red-400 font-medium">0.0</span>
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
                        <p><strong>Legenda:</strong> A1, A2, ... = Número do aluno (passe o mouse para ver o nome). <strong>—</strong> = Autoavaliação (excluída). <strong>0.0</strong> = Faltou. <strong>-</strong> = Sem avaliação. <Wand2 className="inline h-3 w-3 mx-0.5" /> = Não enviou (autopreenchida).</p>
                      </div>
                    </TooltipProvider>
                  )}
                </CardContent>
              </Card>

              {/* ─── Notas de Desempenho da Sessão ─── */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Notas de Desempenho da Sessão
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
                  {desempenhoLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                  ) : !desempenhoResults || desempenhoResults.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma avaliação encontrada para esta sessão.</p>
                  ) : (() => {
                    return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-4 font-semibold w-12">#</th>
                            <th className="pb-3 pr-4 font-semibold">Matrícula</th>
                            <th className="pb-3 pr-4 font-semibold">Aluno</th>
                            <th className="pb-3 pr-4 font-semibold">Papel</th>
                            <th className="pb-3 pr-4 font-semibold text-center">Média Pares</th>
                            {(tutorialEval || isSessionClosed) && <th className="pb-3 pr-4 font-semibold text-center">{isSessionClosed && !tutorialEval ? "Nota Desempenho (Provisória)" : "Nota Desempenho"}</th>}
                            <th className="pb-3 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {desempenhoResults.map((r, i) => (
                            <tr key={r.studentId} className={`border-b last:border-0 transition-colors ${r.absent ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-accent/20"}`}>
                              <td className="py-3 pr-4">
                                <span className="text-muted-foreground">{i + 1}</span>
                              </td>
                              <td className="py-3 pr-4 text-sm font-mono text-muted-foreground">
                                {(r as any).enrollment || (r as any).studentEnrollment || "–"}
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
                                  <span className={`font-medium inline-flex items-center gap-1 ${r.absent ? "text-muted-foreground" : r.desempenhoScore >= 8 ? "text-emerald-600" : r.desempenhoScore >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                    {r.desempenhoScore.toFixed(1)}
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
            {problemDesempenhoResults && problemDesempenhoResults.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportProblemResults}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportProblemPDF}>
                  <FileText className="h-4 w-4 mr-2" />Exportar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportAllClassesProblemPDF} disabled={exportingAllProblem}>
                  <FileText className="h-4 w-4 mr-2" />{exportingAllProblem ? 'Exportando...' : 'Exportar todas as turmas'}
                </Button>
              </div>
            )}
          </div>

          {selectedProblem && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Notas de Desempenho do Problema {selectedProblem}
                </CardTitle>
                <CardDescription>
                  Média das notas finais de desempenho em todas as sessões do problema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {problemDesempenhoLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : !problemDesempenhoResults || problemDesempenhoResults.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado para este problema.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-4 font-semibold w-12">#</th>
                          <th className="pb-3 pr-4 font-semibold">Matrícula</th>
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
                          <th className="pb-3 pr-2 font-semibold text-center">Média Desempenho</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemDesempenhoResults.map((r, i) => (
                          <tr key={r.studentId} className={`border-b last:border-0 transition-colors ${
                            (r as any).excludedFlags?.some(Boolean) ? "bg-orange-50/30 hover:bg-orange-50/50" :
                            r.mediaDesempenho === 0 && r.peerAverage === 0 ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-accent/20"
                          }`}>
                            <td className="py-3 pr-4">
                              <span className="text-muted-foreground">{i + 1}</span>
                            </td>
                            <td className="py-3 pr-4 text-sm font-mono text-muted-foreground">
                              {(r as any).studentEnrollment || "–"}
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
                            {r.desempenhoScores.map((desempenhoScore, idx) => {
                              const isExcluded = (r as any).excludedFlags?.[idx] === true;
                              return (
                                <td key={idx} className="py-3 pr-2 text-center">
                                  {isExcluded ? (
                                    <span className="text-muted-foreground/40">—</span>
                                  ) : (
                                    <span className={desempenhoScore === 0 ? "text-muted-foreground" : "text-sm font-medium"}>
                                      {(desempenhoScore as number)?.toFixed(1) ?? "0.0"}
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
                                  <span className={`font-bold ${r.mediaDesempenho >= 8 ? "text-emerald-600" : r.mediaDesempenho >= 5 ? "text-amber-600" : "text-red-600"}`}>
                                    {r.mediaDesempenho.toFixed(1)}
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
           <ConsolidatedStudentReport classId={selectedClassId!} componentLabel={selectedComponentFullLabel ?? undefined} classCode={selectedClassCode ?? undefined} semester={selectedSemester ?? undefined} onExportAll={exportAllClassesConsolidatedPDF} exportingAll={exportingAllConsolidated} />
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

function ConsolidatedStudentReport({ classId, componentLabel, classCode, semester, onExportAll, exportingAll }: { classId: number; componentLabel?: string; classCode?: string; semester?: string; onExportAll?: () => void; exportingAll?: boolean }) {
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
    const fmtDateCsvCons = (raw: Date | string | null | undefined) => {
      if (!raw) return '';
      return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const sessionHeaders = sessions.map(s => {
      const abbr = `P${s.problemNumber}S${s.sessionNumber}`;
      const d = fmtDateCsvCons((s as any).closedAt || (s as any).createdAt);
      const provisional = s.status === "closed" ? " (P)" : "";
      return d ? `${abbr}${provisional} ${d}` : `${abbr}${provisional}`;
    });
    const header = ["Matrícula", "Aluno", ...sessionHeaders, "Presenças", "Faltas", "Média Desempenho"];
    const extraLines: string[] = [];
    if (hasProvisionalSessions) {
      extraLines.push("ATENÇÃO: Colunas marcadas com (P) contêm notas provisórias (sessão fechada aguardando avaliação do tutorial).");
      extraLines.push("");
    }
    const rows = report.map(r => [
      escapeCSV(r.studentEnrollment),
      escapeCSV(r.studentName),
      ...r.sessions.map(s => s.desempenhoScore.toFixed(1)),
      r.presentCount,
      r.absentCount,
      r.mediaDesempenho.toFixed(1),
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

  // Build ordered column list: sessions grouped by problem, with MPX after each group
  const problemNumbers = Array.from(new Set(sessions.map(s => s.problemNumber))).sort((a, b) => a - b);
  const columnDefs: Array<{ type: 'session'; session: typeof sessions[0]; idx: number } | { type: 'avg'; problemNumber: number }> = [];
  for (const pNum of problemNumbers) {
    const pSessions = sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.problemNumber === pNum);
    pSessions.forEach(({ s, i }) => columnDefs.push({ type: 'session', session: s, idx: i }));
    columnDefs.push({ type: 'avg', problemNumber: pNum });
  }

  // Calculate per-problem average for a student
  const calcProblemAvg = (studentSessions: typeof sessions, pNum: number) => {
    const allPSessions = sessions.filter(s => s.problemNumber === pNum);
    const pStudentSessions = studentSessions.filter(s => s.problemNumber === pNum);
    const totalCount = allPSessions.length;
    if (totalCount === 0) return null;
    const presentSum = pStudentSessions.filter(s => !s.absent && !(s as any).excluded).reduce((sum, s) => sum + s.desempenhoScore, 0);
    const raw = Math.round(presentSum / totalCount * 10) / 10;
    return raw > 10 ? 10 : raw;
  };

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportConsolidated}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!report || report.length === 0) return;
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const sessions = report[0].sessions;
            const pNums = Array.from(new Set(sessions.map((s: any) => s.problemNumber))).sort((a: any, b: any) => a - b) as number[];
            const fmtDateConsSingle = (raw: Date | string | null | undefined) => {
              if (!raw) return '';
              return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            };
            const colHeaders: string[] = ['#', 'Matrícula', 'Aluno'];
            for (const pNum of pNums) {
              const pSessions = sessions.filter((s: any) => s.problemNumber === pNum);
              pSessions.forEach((s: any) => {
                const d = fmtDateConsSingle(s.closedAt || s.createdAt);
                colHeaders.push(d ? `P${s.problemNumber}S${s.sessionNumber} (${d})` : `P${s.problemNumber}S${s.sessionNumber}`);
              });
              colHeaders.push(`MP${pNum}`);
            }
            colHeaders.push('Presenças', 'Faltas', 'Média Desempenho');
            const body = report.map((student: any, idx: number) => {
              const row: string[] = [String(idx + 1), student.studentEnrollment, student.studentName];
              for (const pNum of pNums) {
                const pSessions = sessions.filter((s: any) => s.problemNumber === pNum);
                pSessions.forEach((s: any, i: number) => {
                  const sIdx = sessions.indexOf(s);
                  const sd = student.sessions[sIdx];
                  if (!sd) { row.push('—'); return; }
                  if (sd.excluded) { row.push('E'); return; }
                  if (sd.absent) { row.push('F'); return; }
                  row.push(sd.desempenhoScore.toFixed(1));
                });
                const totalCount = pSessions.length;
                const presentSum = student.sessions.filter((s: any) => s.problemNumber === pNum && !s.absent && !s.excluded).reduce((sum: number, s: any) => sum + s.desempenhoScore, 0);
                const avg = totalCount > 0 ? Math.min(10, Math.round(presentSum / totalCount * 10) / 10) : 0;
                row.push(avg.toFixed(1));
              }
              row.push(String(student.presentCount), String(student.absentCount), student.mediaDesempenho.toFixed(1));
              return row;
            });
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            doc.setFontSize(14);
            doc.text('Relatório Consolidado por Aluno', 14, 18);
            doc.setFontSize(9);
            doc.text(`Componente: ${componentLabel || ''} | Turma: ${classCode || ''} | Semestre: ${semester || ''}`, 14, 26);
            autoTable(doc, {
              startY: 32,
              head: [colHeaders],
              body,
              styles: { fontSize: 7 },
              headStyles: { fillColor: [59, 130, 246] },
              margin: { left: 10, right: 10 },
            });
            const classCodeNormCons = (classCode || 'tp').toLowerCase().replace(/\s/g, '-');
            doc.save(`desempenho-${classCodeNormCons}.pdf`);
          }}>
            <FileText className="h-4 w-4 mr-2" />Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onExportAll} disabled={exportingAll}>
            <FileText className="h-4 w-4 mr-2" />{exportingAll ? 'Exportando...' : 'Exportar todas as turmas'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="py-3 px-3 font-semibold sticky left-0 bg-muted/30 z-10">#</th>
                  <th className="py-3 px-2 font-semibold text-center min-w-[80px] bg-muted/30">Matrícula</th>
                  <th className="py-3 px-3 font-semibold sticky left-8 bg-muted/30 z-10 min-w-[180px]">Aluno</th>
                  {columnDefs.map((col, i) => (
                    col.type === 'avg' ? (
                      <th key={`avg-${col.problemNumber}`} className="py-3 px-2 font-semibold text-center min-w-[60px] bg-blue-50/60">
                        <span className="text-xs text-blue-700 font-bold">MP{col.problemNumber}</span>
                      </th>
                    ) : (
                      <th key={i} className="py-3 px-2 font-semibold text-center min-w-[70px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs">P{col.session.problemNumber}S{col.session.sessionNumber}</span>
                          {col.session.status === "closed" && (
                            <span className="text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-tight">Prov.</span>
                          )}
                        </div>
                      </th>
                    )
                  ))}
                  <th className="py-3 px-2 font-semibold text-center bg-red-50/50">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-xs">Faltas</span>
                    </div>
                  </th>
                  <th className="py-3 px-2 font-semibold text-center bg-amber-50/50">
                    <span className="text-xs font-bold">Média Desempenho</span>
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
                    <td className="py-2.5 px-2 text-center text-xs font-mono text-muted-foreground">
                      {student.studentEnrollment}
                    </td>
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
                    {columnDefs.map((col, i) => {
                      if (col.type === 'avg') {
                        const avg = calcProblemAvg(student.sessions, col.problemNumber);
                        return (
                          <td key={`avg-${col.problemNumber}`} className="py-2.5 px-2 text-center bg-blue-50/30">
                            {avg !== null ? (
                              <span className={`text-xs font-bold ${
                                avg >= 8 ? "text-emerald-600" : avg >= 5 ? "text-amber-600" : avg > 0 ? "text-red-600" : "text-muted-foreground"
                              }`}>{avg.toFixed(1)}</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        );
                      }
                      const s = student.sessions[col.idx];
                      if (!s) return <td key={i} className="py-2.5 px-2 text-center"><span className="text-muted-foreground">—</span></td>;
                      return (
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
                                s.desempenhoScore >= 8 ? "text-emerald-600" : s.desempenhoScore >= 5 ? "text-amber-600" : s.desempenhoScore > 0 ? "text-red-600" : "text-muted-foreground"
                              }`}>
                                {s.desempenhoScore > 0 ? s.desempenhoScore.toFixed(1) : "—"}
                              </span>
                              <span className="text-[9px] text-muted-foreground">{s.role.substring(0, 4)}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
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
                            student.mediaDesempenho >= 8 ? "text-emerald-600" : student.mediaDesempenho >= 5 ? "text-amber-600" : student.mediaDesempenho > 0 ? "text-red-600" : "text-muted-foreground"
                          }`}>
                            {student.mediaDesempenho > 0 ? student.mediaDesempenho.toFixed(1) : "—"}
                          </span>
                          {(student as any).mediaDesempenhoCapped && (
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
