import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Send, Eye } from "lucide-react";

const SCORE_LABELS_FEM: Record<string, string> = {
  "0.00": "Nenhuma",
  "0.25": "Fraca",
  "0.50": "Razoável",
  "0.75": "Boa",
  "1.00": "Excelente",
};

const SCORE_LABELS_MASC: Record<string, string> = {
  "0.00": "Nenhum",
  "0.25": "Fraco",
  "0.50": "Razoável",
  "0.75": "Bom",
  "1.00": "Excelente",
};

const PENALTY_LABELS: Record<string, string> = {
  "0.00": "Nenhum",
  "0.25": "Fraco",
  "0.50": "Razoável",
  "0.75": "Bom",
  "1.00": "Excelente",
};

function getScoreLabel(value: number, gender: "fem" | "masc" = "fem", penalty?: boolean): string {
  if (penalty) return PENALTY_LABELS[value.toFixed(2)] ?? value.toFixed(2);
  const labels = gender === "masc" ? SCORE_LABELS_MASC : SCORE_LABELS_FEM;
  return labels[value.toFixed(2)] ?? value.toFixed(2);
}

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

function PreviewCriteriaSlider({ label, sublabel, tooltip, value, penalty, gender = "fem" }: {
  label: string;
  sublabel?: string;
  tooltip?: string;
  value: number;
  penalty?: boolean;
  gender?: "fem" | "masc";
}) {
  const color = penalty
    ? (value >= 0.75 ? "text-red-600" : value >= 0.5 ? "text-amber-600" : "text-emerald-600")
    : (value >= 0.75 ? "text-emerald-600" : value >= 0.5 ? "text-amber-600" : "text-red-600");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}</Label>
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
                      <p key={i}><strong>{concept}:</strong> {rest.join(": ")}</p>
                    ) : (
                      <p key={i}><em>{line}</em></p>
                    );
                  }) : <p>{tooltip}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {sublabel && <span className="text-xs text-muted-foreground ml-1">({sublabel})</span>}
        </div>
        <span className={`text-sm font-bold ${color}`}>{getScoreLabel(value, penalty ? "masc" : gender, penalty)}</span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.25}
        value={[value]}
        disabled
        className="w-full opacity-70"
      />
      <div className="flex justify-between text-xs font-medium">
        {penalty ? (
          <>
            <span className="text-emerald-600">Nenhum</span>
            <span className="text-lime-600">Fraco</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-orange-600">Bom</span>
            <span className="text-red-600">Excelente</span>
          </>
        ) : gender === "masc" ? (
          <>
            <span className="text-red-600">Nenhum</span>
            <span className="text-orange-500">Fraco</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-lime-600">Bom</span>
            <span className="text-emerald-600">Excelente</span>
          </>
        ) : (
          <>
            <span className="text-red-600">Nenhuma</span>
            <span className="text-orange-500">Fraca</span>
            <span className="text-amber-500">Razoável</span>
            <span className="text-lime-600">Boa</span>
            <span className="text-emerald-600">Excelente</span>
          </>
        )}
      </div>
    </div>
  );
}

// Dados fictícios dos colegas para a prévia
const demoPeers = [
  { studentId: 1, studentName: "Ana Clara Souza", role: "COORDENADOR", photoUrl: null },
  { studentId: 2, studentName: "Bruno Oliveira", role: "MESA", photoUrl: null },
  { studentId: 3, studentName: "Carlos Eduardo Lima", role: "QUADRO", photoUrl: null },
  { studentId: 4, studentName: "Diana Santos", role: "PARTICIPANTE", photoUrl: null },
];

/**
 * Diálogo de prévia do formulário de avaliação dos alunos.
 * Mostra exatamente como o formulário aparece para os alunos, com dados fictícios.
 * Reflete o formulário atual: papel definido pelo professor (não editável), sem seleção de falta,
 * "Desempenho" apenas para Coordenador/Mesa/Quadro.
 */
export function EvaluationPreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Prévia do Formulário de Avaliação
          </DialogTitle>
          <DialogDescription>
            Visualização de como o formulário de avaliação entre pares aparece para os alunos.
            Os controles estão desabilitados — esta é apenas uma prévia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Header info */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
            <p className="text-sm text-blue-800">
              <strong>Exemplo:</strong> O aluno vê este formulário para cada colega presente na sessão.
              O papel de cada colega é definido pelo professor ao criar a sessão.
              O critério "Desempenho" aparece apenas para Coordenador, Mesa e Quadro.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <strong>Importante:</strong> O preenchimento deste formulário é um requisito obrigatório para obtenção da nota de desempenho da sessão tutorial do componente. Avalie de forma objetiva e imparcial, baseando-se apenas nas contribuições e discussões ocorridas durante a sessão tutorial.
            </p>
          </div>

          {/* Summary bar */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span>Avaliando <strong>{demoPeers.length}</strong> colegas</span>
                <div className="flex gap-2">
                  {demoPeers.map(p => (
                    <Badge key={p.studentId} variant="outline" className={`text-xs ${roleBadgeColors[p.role]}`}>
                      {roleLabels[p.role]}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo student cards */}
          {demoPeers.map((peer) => {
            const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(peer.role);
            const demoScore = 1 * 1 + 1 * 3 + 1 * 3 + 1 * 3; // 10.0 sem penalidade
            return (
              <Card key={peer.studentId}>
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
                        <Badge variant="outline" className={`text-xs mt-1 ${roleBadgeColors[peer.role]}`}>
                          {roleLabels[peer.role]}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-lg font-bold px-3 py-1 border-emerald-300 text-emerald-700">
                      {demoScore.toFixed(1)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Separator />

                  <TooltipProvider>
                    <div className="space-y-4">
                      <PreviewCriteriaSlider
                        label="Pontualidade"
                        sublabel="Peso 1"
                        tooltip="Excelente: Estava presente desde o início do tutorial, cumprindo integralmente o horário. | Boa: Chegou com até 10 minutos de atraso. | Razoável: Chegou com atraso considerável, mas antes da primeira hora. | Fraca: Chegou até 1h10 depois do início. | Nenhuma: Chegou após 1h10 do início."
                        value={1}
                        gender="fem"
                      />
                      <PreviewCriteriaSlider
                        label="Pesquisa / Metas"
                        sublabel="Peso 3"
                        tooltip="Excelente: Cumpriu todas as metas e/ou realizou tarefas extras. | Boa: Realizou a pesquisa e cumpriu a maior parte das metas. | Razoável: Cumpriu parcialmente ou pesquisou de forma superficial. | Fraca: Resultados insuficientes ou pesquisas irrelevantes. | Nenhuma: Não realizou pesquisas nem cumpriu metas."
                        value={1}
                        gender="fem"
                      />
                      <PreviewCriteriaSlider
                        label="Domínio do Assunto"
                        sublabel="Peso 3"
                        tooltip="Excelente: Trouxe novos conceitos e/ou corrigiu equívocos com clareza. | Bom: Compreendeu a maioria dos pontos e aplicou conceitos com segurança. | Razoável: Conhecimento básico, dificuldade para explicar ideias. | Fraco: Citou termos, mas não soube explicá-los. | Nenhum: Apenas ouvinte, sem demonstrar conhecimento."
                        value={1}
                        gender="masc"
                      />
                      <PreviewCriteriaSlider
                        label="Participação"
                        sublabel="Peso 3"
                        tooltip="Excelente: Participou ativamente, estimulou o debate e aprofundou a discussão. | Boa: Contribuiu frequentemente, ouviu colegas e fez perguntas pertinentes. | Razoável: Participou pontualmente ou só quando solicitado. | Fraca: Contribuiu minimamente, dispersou atenção. | Nenhuma: Silêncio absoluto ou total desinteresse."
                        value={1}
                        gender="fem"
                      />
                      {hasRolePenalty && (
                        <PreviewCriteriaSlider
                          label="Desempenho no Papel"
                          sublabel="Penalidade (até -1)"
                          tooltip={`Esta nota tem peso negativo porque trata de comportamentos já esperados durante o tutorial. | Excelente: Cumpriu todas as funções da forma esperada. | Bom: Executou a maior parte das funções, mas falhou em pontos isolados. | Razoável: Tentou executar a função, mas deixou de realizar metade das tarefas. | Fraco: Realizou apenas tarefas mínimas ou superficiais. | Nenhum: Não cumpriu as funções essenciais de sua responsabilidade.`}
                          value={0}
                          penalty
                        />
                      )}
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            );
          })}

          {/* Disabled submit button */}
          <div className="flex justify-end">
            <Button size="lg" disabled className="shadow-md opacity-50">
              <Send className="h-4 w-4 mr-2" />
              Enviar Avaliação
            </Button>
          </div>

          {/* Explanation */}
          <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
            <p><strong>Nota máxima possível:</strong> 10.0 pontos (Pontualidade ×1 + Pesquisa/Metas ×3 + Domínio ×3 + Participação ×3)</p>
            <p><strong>Fórmula:</strong> Nota = (Pontualidade × 1) + (Pesquisa/Metas × 3) + (Domínio × 3) + (Participação × 3) − (Penalidade Papel × 1)</p>
            <p><strong>Penalidade de Papel:</strong> Aplica-se apenas a Coordenador, Mesa e Quadro. Participantes não recebem penalidade.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EvaluationPreviewDialog;
