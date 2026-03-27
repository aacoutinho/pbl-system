import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Send, Eye, RotateCcw, CheckCircle2, Calculator, AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CriteriaSlider (idêntico ao do StudentAccessPage) ───

const CS_SNAP_POINTS = [0, 0.25, 0.5, 0.75, 1.0];

const CS_LABELS_FEM = [
  { label: "Nenhuma", value: 0 },
  { label: "Fraca", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Boa", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const CS_LABELS_MASC = [
  { label: "Nenhum", value: 0 },
  { label: "Fraco", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const CS_LABELS_PENALTY = [
  { label: "Nenhum", value: 1.0 },
  { label: "Fraco", value: 0.75 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.25 },
  { label: "Excelente", value: 0.0 },
] as const;

function csGetTrackColor(v: number): string {
  if (v <= 0) return "#ef4444";
  if (v <= 0.25) return "#f97316";
  if (v <= 0.5) return "#f59e0b";
  if (v <= 0.75) return "#65a30d";
  return "#059669";
}

function csPenaltyTrackColor(v: number): string {
  if (v >= 1) return "#ef4444";
  if (v >= 0.75) return "#f97316";
  if (v >= 0.5) return "#f59e0b";
  if (v >= 0.25) return "#65a30d";
  return "#059669";
}

function csFractionToDisplay(v: number): string {
  return (Math.round(v * 100) / 10).toFixed(1);
}

function csDisplayToFraction(s: string): number | null {
  const n = parseFloat(s);
  if (isNaN(n) || n < 0 || n > 10) return null;
  return Math.round((n / 10) * 100) / 100;
}

function CriteriaSlider({ label, sublabel, tooltip, value, onChange, penalty, gender = "masc" }: {
  label: string;
  sublabel?: string;
  tooltip?: string;
  value: number;
  onChange: (v: number) => void;
  penalty?: boolean;
  gender?: "fem" | "masc";
}) {
  const sliderFrac = penalty ? 1 - value : value;
  const trackColor = penalty ? csPenaltyTrackColor(value) : csGetTrackColor(value);
  const fillPct = sliderFrac * 100;

  const [inputText, setInputText] = useState(() => csFractionToDisplay(sliderFrac));
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!inputFocused) {
      setInputText(csFractionToDisplay(sliderFrac));
    }
  }, [sliderFrac, inputFocused]);

  const trackRef = useRef<HTMLDivElement>(null);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    const snapped = Math.round(raw * 10) / 100;
    const newValue = penalty ? 1 - snapped : snapped;
    onChange(newValue);
    setInputText(csFractionToDisplay(snapped));
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, raw));
    const snapped = Math.round(clamped * 10) / 10;
    const newValue = penalty ? 1 - snapped : snapped;
    onChange(newValue);
    setInputText(csFractionToDisplay(snapped));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    const frac = csDisplayToFraction(inputText);
    if (frac !== null) {
      const clamped = Math.min(1, Math.max(0, frac));
      const newValue = penalty ? 1 - clamped : clamped;
      onChange(newValue);
      setInputText(csFractionToDisplay(clamped));
    } else {
      setInputText(csFractionToDisplay(sliderFrac));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  const conceptLabels = penalty ? CS_LABELS_PENALTY : (gender === "masc" ? CS_LABELS_MASC : CS_LABELS_FEM);
  const getConceptSliderPos = (conceptValue: number) => penalty ? 1 - conceptValue : conceptValue;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <div className="space-y-1">
                {tooltip.includes("|") ? tooltip.split(" | ").map((line, i) => {
                  const [concept, ...rest] = line.split(": ");
                  return rest.length > 0 ? (
                    <p key={i}><strong className="text-foreground">{concept}:</strong> {rest.join(": ")}</p>
                  ) : (
                    <p key={i}>{line}</p>
                  );
                }) : <p>{tooltip}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {sublabel && <span className="text-xs text-muted-foreground">({sublabel})</span>}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <div className="relative flex-1">
          <div
            ref={trackRef}
            className="relative h-6 flex items-center cursor-pointer"
            onClick={handleTrackClick}
          >
            <div className="absolute inset-y-0 left-0 right-0 my-auto h-2 rounded-full bg-muted" />
            <div
              className="absolute left-0 my-auto h-2 rounded-full transition-all duration-100"
              style={{ width: `${fillPct}%`, top: 0, bottom: 0, margin: 'auto', backgroundColor: trackColor }}
            />
            {Array.from({ length: 101 }, (_, i) => Math.round(i) / 100).map((tick) => {
              const isConcept = CS_SNAP_POINTS.includes(tick);
              const isActive = Math.abs(sliderFrac - tick) < 0.005;
              return (
                <div
                  key={tick}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${tick * 100}%`,
                    top: '50%',
                    transform: 'translateX(-50%) translateY(-50%)',
                  }}
                >
                  <div
                    style={{
                      width: isConcept ? '6px' : '3px',
                      height: isConcept ? '14px' : '8px',
                      borderRadius: '2px',
                      backgroundColor: isActive ? 'white' : isConcept ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)',
                      opacity: isActive ? 0 : 1,
                    }}
                  />
                </div>
              );
            })}
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={sliderFrac * 10}
              onChange={handleSliderChange}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ margin: 0 }}
            />
            <div
              className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md transition-all duration-100 pointer-events-none"
              style={{
                left: `${fillPct}%`,
                top: '50%',
                transform: 'translateX(-50%) translateY(-50%)',
                backgroundColor: trackColor,
              }}
            />
          </div>

          <div className="relative w-full mt-2">
            {conceptLabels.map((opt, idx) => {
              const sliderPos = getConceptSliderPos(opt.value);
              const isActive = Math.abs(sliderFrac - sliderPos) < 0.01;
              const labelColor = penalty ? csPenaltyTrackColor(opt.value) : csGetTrackColor(opt.value);
              const isFirst = idx === 0;
              const isLast = idx === conceptLabels.length - 1;
              const transformX = isFirst ? "0%" : isLast ? "-100%" : "-50%";
              return (
                <div
                  key={opt.value}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${sliderPos * 100}%`, transform: `translateX(${transformX})` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setInputText(csFractionToDisplay(sliderPos));
                    }}
                    className={cn(
                      "text-[11px] whitespace-nowrap transition-all rounded px-1 py-0.5",
                      "focus:outline-none focus:ring-1 focus:ring-ring",
                      isActive ? "font-bold" : "text-muted-foreground hover:font-semibold"
                    )}
                    style={{ color: isActive ? labelColor : undefined }}
                    title={`Definir como ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <input
            type="text"
            inputMode="decimal"
            value={inputText}
            onChange={handleInputChange}
            onFocus={() => setInputFocused(true)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className={cn(
              "w-16 text-center text-base font-bold rounded-md border px-2 py-1 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "bg-background"
            )}
            style={{ color: trackColor, borderColor: trackColor }}
          />
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      </div>
      <div className="h-5" />
    </div>
  );
}

// ─── Dados fictícios e tipos ───

interface DemoPeer {
  studentId: number;
  studentName: string;
  role: "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";
}

interface PeerEval {
  pontualidade: number;
  pesquisaMetas: number;
  dominio: number;
  participacao: number;
  desempenhoPapel: number;
}

const demoPeers: DemoPeer[] = [
  { studentId: 1, studentName: "Ana Clara Souza", role: "COORDENADOR" },
  { studentId: 2, studentName: "Bruno Oliveira", role: "MESA" },
  { studentId: 3, studentName: "Carlos Eduardo Lima", role: "QUADRO" },
  { studentId: 4, studentName: "Diana Santos", role: "PARTICIPANTE" },
];

const defaultEval = (): PeerEval => ({
  pontualidade: 1,
  pesquisaMetas: 1,
  dominio: 1,
  participacao: 1,
  desempenhoPapel: 0,
});

const roleLabels: Record<string, string> = {
  COORDENADOR: "Coordenador",
  MESA: "Mesa",
  QUADRO: "Quadro",
  PARTICIPANTE: "Participante",
};

const roleBadgeColors: Record<string, string> = {
  COORDENADOR: "bg-blue-100 text-blue-800 border-blue-300",
  MESA: "bg-purple-100 text-purple-800 border-purple-300",
  QUADRO: "bg-teal-100 text-teal-800 border-teal-300",
  PARTICIPANTE: "bg-gray-100 text-gray-700 border-gray-300",
};

function calcScore(ev: PeerEval, hasRolePenalty: boolean): number {
  return ev.pontualidade * 1 + ev.pesquisaMetas * 3 + ev.dominio * 3 + ev.participacao * 3
    - (hasRolePenalty ? ev.desempenhoPapel * 1 : 0);
}

// ─── Diálogo de Prévia ───

/**
 * Diálogo de prévia do formulário de avaliação dos alunos.
 * Totalmente funcional: sliders interativos, campo numérico, conceitos clicáveis.
 * Idêntico ao formulário preenchido pelos alunos.
 */
export function EvaluationPreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [evaluations, setEvaluations] = useState<Record<number, PeerEval>>(() => {
    const init: Record<number, PeerEval> = {};
    demoPeers.forEach(p => { init[p.studentId] = defaultEval(); });
    return init;
  });
  const [submitted, setSubmitted] = useState(false);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEvaluations(() => {
          const init: Record<number, PeerEval> = {};
          demoPeers.forEach(p => { init[p.studentId] = defaultEval(); });
          return init;
        });
        setSubmitted(false);
      }, 300);
    }
  }, [open]);

  const updateEval = (studentId: number, field: keyof PeerEval, value: number) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleReset = () => {
    const init: Record<number, PeerEval> = {};
    demoPeers.forEach(p => { init[p.studentId] = defaultEval(); });
    setEvaluations(init);
    setSubmitted(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Prévia do Formulário de Avaliação
          </DialogTitle>
          <DialogDescription>
            Simulação interativa do formulário de avaliação entre pares. Os controles estão totalmente funcionais — experimente mover os sliders.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-bold">Avaliação Enviada (Simulação)</h2>
            <p className="text-muted-foreground max-w-sm">
              Na versão real, os dados seriam enviados ao servidor e registrados. Esta é apenas uma prévia.
            </p>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reiniciar Prévia
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Header info */}
            <div className="space-y-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Sessão Tutorial — Exemplo</h1>
                <p className="text-muted-foreground">
                  Olá, <strong>Estudante Exemplo</strong>. Avalie o desempenho dos seus colegas.
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                  <strong>Importante:</strong> O preenchimento deste formulário é um requisito obrigatório para obtenção da nota de desempenho da sessão tutorial do componente. Avalie de forma objetiva e imparcial, baseando-se apenas nas contribuições e discussões ocorridas durante a sessão tutorial.
                </p>
              </div>
            </div>

            {/* Profile info card */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center border-2 border-blue-300 shrink-0">
                    <span className="text-sm font-medium text-blue-800">E</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">estudante@ecomp.uefs.br</p>
                    <p className="text-xs text-muted-foreground">TEC502 - TP01 (2026.1)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary bar */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Avaliando <strong>{demoPeers.length}</strong> colegas</span>
                  <div className="flex gap-2 flex-wrap">
                    {demoPeers.filter(p => p.role !== "PARTICIPANTE").map(p => (
                      <Badge key={p.role} variant="outline" className={`text-xs ${roleBadgeColors[p.role]}`}>
                        {roleLabels[p.role]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peer cards — fully interactive */}
            {demoPeers.map((peer) => {
              const ev = evaluations[peer.studentId];
              if (!ev) return null;
              const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(peer.role);
              const totalScore = calcScore(ev, hasRolePenalty);

              return (
                <Card key={peer.studentId} className="transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border-2 border-muted shrink-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            {peer.studentName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-base">{peer.studentName}</CardTitle>
                          <Badge
                            variant={peer.role === "PARTICIPANTE" ? "secondary" : "default"}
                            className="text-xs mt-1"
                          >
                            {roleLabels[peer.role]}
                          </Badge>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-lg font-bold px-3 py-1 ${
                          totalScore >= 8 ? "border-emerald-300 text-emerald-700"
                          : totalScore >= 5 ? "border-amber-300 text-amber-700"
                          : "border-red-300 text-red-700"
                        }`}
                      >
                        {totalScore.toFixed(1)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Separator />
                    <TooltipProvider>
                      <div className="space-y-4">
                        <CriteriaSlider
                          label="Pontualidade"
                          sublabel="Peso 1"
                          tooltip="Excelente: Estava presente desde o início do tutorial, cumprindo integralmente o horário. | Boa: Chegou com até 10 minutos de atraso em relação ao início do tutorial. | Razoável: Chegou com atraso considerável, mas antes da primeira hora. | Fraca: Chegou até uma hora e 10 minutos depois do início do tutorial. | Nenhuma: Chegou após uma hora e 10 minutos do início do tutorial."
                          value={ev.pontualidade}
                          onChange={(v) => updateEval(peer.studentId, "pontualidade", v)}
                          gender="fem"
                        />
                        <CriteriaSlider
                          label="Pesquisa / Metas"
                          sublabel="Peso 3"
                          tooltip="Excelente: Cumpriu todas as metas e pesquisas propostas e/ou realizou tarefas extras não solicitadas. | Boa: Realizou a pesquisa e cumpriu a maior parte das metas propostas de forma satisfatória. | Razoável: Cumpriu as metas apenas parcialmente ou realizou a pesquisa de forma superficial/insuficiente. | Fraca: Entregou resultados insuficientes para o grupo ou trouxe pesquisas irrelevantes para os objetivos do tutorial. | Nenhuma: Não realizou as pesquisas solicitadas nem cumpriu qualquer uma das metas estabelecidas."
                          value={ev.pesquisaMetas}
                          onChange={(v) => updateEval(peer.studentId, "pesquisaMetas", v)}
                          gender="fem"
                        />
                        <CriteriaSlider
                          label="Domínio do Assunto"
                          sublabel="Peso 3"
                          tooltip="Excelente: Trouxe novos conceitos e/ou corrigiu com clareza equívocos apresentados pelo grupo. | Bom: Compreendeu a maioria dos pontos e aplicou os conceitos discutidos com segurança. | Razoável: Demonstrou conhecimento básico, mas apresentou dificuldade para explicar ou fundamentar suas ideias. | Fraco: Citou conceitos novos ou termos da área, porém não soube explicá-los ou aplicá-los corretamente. | Nenhum: Atuou apenas como ouvinte e não demonstrou qualquer conhecimento sobre o tema proposto."
                          value={ev.dominio}
                          onChange={(v) => updateEval(peer.studentId, "dominio", v)}
                          gender="masc"
                        />
                        <CriteriaSlider
                          label="Participação"
                          sublabel="Peso 3"
                          tooltip="Excelente: Participou ativamente, estimulou o debate construtivo e contribuiu para o aprofundamento da discussão. | Boa: Contribuiu com as discussões de forma frequente, ouviu os colegas e fez perguntas pertinentes. | Razoável: Participou de forma pontual ou apenas quando solicitado, com poucas contribuições voluntárias. | Fraca: Contribuiu minimamente com o grupo e, em alguns momentos, dispersou a atenção ou atrapalhou o fluxo. | Nenhuma: Permaneceu em silêncio absoluto ou demonstrou total desinteresse pelas atividades e pelo grupo."
                          value={ev.participacao}
                          onChange={(v) => updateEval(peer.studentId, "participacao", v)}
                          gender="fem"
                        />
                        {hasRolePenalty && (
                          <CriteriaSlider
                            label="Desempenho no Papel"
                            sublabel="Penalidade: até -1"
                            tooltip="Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial. | Excelente: Cumpriu todas as funções da forma esperada (ex: coordenador seguiu a pauta e gerenciou o tempo; quadro anotou os pontos principais com clareza; mesa registrou todos os dados e publicou prontamente). | Bom: Executou a maior parte das funções, mas falhou em pontos isolados. | Razoável: Tentou executar a função, mas deixou de realizar metade das tarefas. | Fraco: Realizou apenas tarefas mínimas ou superficiais, demonstrando desinteresse. | Nenhum: Não cumpriu as funções essenciais de sua responsabilidade."
                            value={ev.desempenhoPapel}
                            onChange={(v) => updateEval(peer.studentId, "desempenhoPapel", v)}
                            penalty
                          />
                        )}
                      </div>
                    </TooltipProvider>
                  </CardContent>
                </Card>
              );
            })}

            {/* Submit + Reset buttons */}
            <div className="flex items-center justify-between pb-8">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reiniciar valores
              </Button>
              <Button size="lg" onClick={() => setSubmitted(true)} className="shadow-md">
                <Send className="h-4 w-4 mr-2" />
                Enviar Avaliação
              </Button>
            </div>

            {/* Formula explanation — redesigned */}
            <Card className="border-border/60 bg-muted/30">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Calculator className="h-4 w-4" />
                  Como a nota é calculada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                {/* Criteria weights */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Critérios e pesos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Pontualidade", weight: 1, color: "bg-sky-100 text-sky-800 border-sky-300" },
                      { label: "Pesquisa / Metas", weight: 3, color: "bg-violet-100 text-violet-800 border-violet-300" },
                      { label: "Domínio do Assunto", weight: 3, color: "bg-violet-100 text-violet-800 border-violet-300" },
                      { label: "Participação", weight: 3, color: "bg-violet-100 text-violet-800 border-violet-300" },
                    ].map(({ label, weight, color }) => (
                      <div key={label} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                        <span className="text-xs text-foreground">{label}</span>
                        <Badge variant="outline" className={`text-xs font-bold ${color}`}>×{weight}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Formula */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Fórmula</p>
                  <div className="rounded-md bg-background border px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground/80">
                    <span className="font-bold text-emerald-700">Nota</span>
                    {" = "}
                    <span className="text-sky-700">(Pontualidade × 1)</span>
                    {" + "}
                    <span className="text-violet-700">(Pesquisa × 3)</span>
                    {" + "}
                    <span className="text-violet-700">(Domínio × 3)</span>
                    {" + "}
                    <span className="text-violet-700">(Participação × 3)</span>
                    {" − "}
                    <span className="text-orange-600">(Desempenho Papel × 1)</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <Trophy className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs text-emerald-800">
                      <strong>Nota máxima:</strong> 10.0 pontos — quando todos os critérios recebem <em>Excelente</em>
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Penalty note */}
                <div className="flex items-start gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800 space-y-0.5">
                    <p className="font-semibold">Penalidade de Papel</p>
                    <p>Aplica-se apenas a <strong>Coordenador</strong>, <strong>Mesa</strong> e <strong>Quadro</strong>. Participantes não recebem penalidade.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EvaluationPreviewDialog;
