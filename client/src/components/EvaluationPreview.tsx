import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserX, AlertTriangle, HelpCircle, Send, Eye } from "lucide-react";
import { useState } from "react";
import { BahiaGlossary } from "./BahiaGlossary";

const SCORE_LABELS: Record<string, string> = {
  "0.00": "Calado",
  "0.25": "Paia",
  "0.50": "Meiaboca",
  "0.75": "Massa",
  "1.00": "Brocou",
};

const PENALTY_LABELS: Record<string, string> = {
  "0.00": "De boa",
  "0.25": "Vacilou",
  "0.50": "Pisou na bola",
  "0.75": "Mancou feio",
  "1.00": "Lascou tudo",
};

function getScoreLabel(value: number, penalty?: boolean): string {
  const labels = penalty ? PENALTY_LABELS : SCORE_LABELS;
  return labels[value.toFixed(2)] ?? value.toFixed(2);
}

function PreviewCriteriaSlider({ label, sublabel, tooltip, value, penalty }: {
  label: string;
  sublabel?: string;
  tooltip?: string;
  value: number;
  penalty?: boolean;
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
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {sublabel && <span className="text-xs text-muted-foreground ml-1">({sublabel})</span>}
        </div>
        <span className={`text-sm font-bold ${color}`}>{getScoreLabel(value, penalty)}</span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.25}
        value={[value]}
        disabled
        className="w-full opacity-70"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        {penalty ? (
          <>
            <span>Sem penalidade</span>
            <span>Leve</span>
            <span>Moderada</span>
            <span>Grave</span>
            <span>Máxima</span>
          </>
        ) : (
          <>
            <span>Nenhum</span>
            <span>Fraco</span>
            <span>Normal</span>
            <span>Bom</span>
            <span>Excelente</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Diálogo de prévia do formulário de avaliação dos alunos.
 * Mostra exatamente como o formulário aparece para os alunos, com dados fictícios.
 */
export function EvaluationPreviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [demoAbsent, setDemoAbsent] = useState(false);
  const [demoRole, setDemoRole] = useState("PARTICIPANTE");

  const demoScore = demoAbsent ? 0 : 1 * 1 + 1 * 3 + 1 * 3 + 1 * 3 - 0 * 1;

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
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Exemplo:</strong> O aluno vê este formulário para cada colega da sessão.
              Ele atribui um papel, marca presença/ausência e avalia 5 critérios.
            </p>
          </div>

          {/* Summary bar */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span>Avaliando <strong>4</strong> colegas (0 faltas)</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">COORDENADOR</Badge>
                  <Badge variant="outline" className="text-xs">MESA</Badge>
                  <Badge variant="outline" className="text-xs">QUADRO</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo student card */}
          <Card className={`transition-all ${demoAbsent ? "opacity-60 bg-muted/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Aluno Exemplo da Silva</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  {!demoAbsent && (
                    <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${demoScore >= 8 ? "border-emerald-300 text-emerald-700" : demoScore >= 5 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                      {demoScore.toFixed(1)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor="demo-absent" className="text-sm text-muted-foreground">
                      <UserX className="h-4 w-4" />
                    </Label>
                    <Switch
                      id="demo-absent"
                      checked={demoAbsent}
                      onCheckedChange={setDemoAbsent}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            {!demoAbsent && (
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Papel na sessão</Label>
                  <Select value={demoRole} onValueChange={setDemoRole}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTICIPANTE">Participante</SelectItem>
                      <SelectItem value="COORDENADOR">Coordenador</SelectItem>
                      <SelectItem value="MESA">Mesa</SelectItem>
                      <SelectItem value="QUADRO">Quadro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <TooltipProvider>
                  <div className="space-y-4">
                    <PreviewCriteriaSlider
                      label="Pontualidade"
                      sublabel="Peso 1"
                      tooltip="Avalia se o colega chegou no horário e permaneceu durante toda a sessão tutorial."
                      value={1}
                    />
                    <PreviewCriteriaSlider
                      label="Pesquisa / Metas"
                      sublabel="Peso 3"
                      tooltip="Avalia se o colega pesquisou previamente sobre o tema, trouxe materiais relevantes e cumpriu as metas estabelecidas na sessão anterior."
                      value={1}
                    />
                    <PreviewCriteriaSlider
                      label="Domínio do Assunto"
                      sublabel="Peso 3"
                      tooltip="Avalia o nível de conhecimento demonstrado pelo colega sobre o tema discutido na sessão tutorial."
                      value={1}
                    />
                    <PreviewCriteriaSlider
                      label="Participação"
                      sublabel="Peso 3"
                      tooltip="Avalia o envolvimento ativo do colega nas discussões, contribuindo com ideias, perguntas e argumentos durante a sessão."
                      value={1}
                    />
                    <PreviewCriteriaSlider
                      label="Desempenho no Papel"
                      sublabel="Penalidade (até -1)"
                      tooltip="Penalidade aplicada quando o colega não desempenhou adequadamente o papel atribuído (Coordenador, Mesa ou Quadro). Se desempenhou bem, deixe em 'Sem penalidade'."
                      value={0}
                      penalty
                    />
                  </div>
                </TooltipProvider>
              </CardContent>
            )}

            {demoAbsent && (
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Marcado como ausente. A nota será 0 e não será contabilizada na média.
                </div>
              </CardContent>
            )}
          </Card>

          {/* Disabled submit button */}
          <div className="flex justify-end">
            <Button size="lg" disabled className="shadow-md opacity-50">
              <Send className="h-4 w-4 mr-2" />
              Enviar Avaliação
            </Button>
          </div>

          {/* Glossary */}
          <BahiaGlossary compact />

          {/* Explanation */}
          <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
            <p><strong>Nota máxima possível:</strong> 10.0 pontos (Pontualidade ×1 + Pesquisa/Metas ×3 + Domínio ×3 + Participação ×3 − Desempenho no Papel ×1)</p>
            <p><strong>Fórmula:</strong> Nota = (Pontualidade × 1) + (Pesquisa/Metas × 3) + (Domínio × 3) + (Participação × 3) − (Penalidade Papel × 1)</p>
            <p><strong>Ausência:</strong> Se marcado como ausente, a nota é 0 e não entra na média.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EvaluationPreviewDialog;
