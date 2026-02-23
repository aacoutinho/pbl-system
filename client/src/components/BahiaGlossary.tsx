import React from "react";
import { Info } from "lucide-react";

/**
 * Glossário de gírias baianas usado na escala de avaliação.
 * Componente reutilizável para ser incluído em formulários de avaliação e resultados.
 */
export function BahiaGlossary({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold mb-1">Glossário Bahianês</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            <div><strong>Calado</strong> — Nenhum / Péssimo (0)</div>
            <div><strong>Paia</strong> — Fraco / Ruim (0.25)</div>
            <div><strong>Na estica</strong> — Razoável / Mediano (0.5)</div>
            <div><strong>Massa</strong> — Bom / Legal (0.75)</div>
            <div><strong>Brocou</strong> — Excelente / Arrasou (1.0)</div>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-200/60">
            <p className="font-semibold mb-0.5">Penalidades (Desempenho no Papel):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              <div><strong>De boa</strong> — Sem penalidade (0)</div>
              <div><strong>Vacilou</strong> — Penalidade leve (0.25)</div>
              <div><strong>Pisou na bola</strong> — Penalidade moderada (0.5)</div>
              <div><strong>Mancou feio</strong> — Penalidade grave (0.75)</div>
              <div><strong>Lascou tudo</strong> — Penalidade máxima (1.0)</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-100/60 border-b border-amber-200">
        <Info className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Glossário Bahianês — Escala de Avaliação</h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Conceitos de Avaliação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <GlossaryItem term="Calado" meaning="Nenhum / Péssimo" value="0" color="red" />
            <GlossaryItem term="Paia" meaning="Fraco / Ruim" value="0.25" color="orange" />
            <GlossaryItem term="Na estica" meaning="Razoável / Mediano" value="0.5" color="amber" />
            <GlossaryItem term="Massa" meaning="Bom / Legal" value="0.75" color="emerald" />
            <GlossaryItem term="Brocou" meaning="Excelente / Arrasou" value="1.0" color="green" />
          </div>
        </div>
        <div className="border-t border-amber-200 pt-3">
          <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Penalidades (Desempenho no Papel)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <GlossaryItem term="De boa" meaning="Sem penalidade" value="0" color="green" />
            <GlossaryItem term="Vacilou" meaning="Penalidade leve" value="0.25" color="amber" />
            <GlossaryItem term="Pisou na bola" meaning="Penalidade moderada" value="0.5" color="orange" />
            <GlossaryItem term="Mancou feio" meaning="Penalidade grave" value="0.75" color="red" />
            <GlossaryItem term="Lascou tudo" meaning="Penalidade máxima" value="1.0" color="red" />
          </div>
        </div>
        <p className="text-xs text-amber-700 italic">
          Expressões típicas da Bahia usadas para tornar a avaliação mais leve e divertida.
          Os valores numéricos são usados internamente para o cálculo das notas.
        </p>
      </div>
    </div>
  );
}

const colorMap: Record<string, string> = {
  red: "bg-red-100 border-red-200 text-red-800",
  orange: "bg-orange-100 border-orange-200 text-orange-800",
  amber: "bg-amber-100 border-amber-200 text-amber-800",
  emerald: "bg-emerald-100 border-emerald-200 text-emerald-800",
  green: "bg-green-100 border-green-200 text-green-800",
};

function GlossaryItem({ term, meaning, value, color }: { term: string; meaning: string; value: string; color: string }) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 rounded-md border text-xs ${colorMap[color] ?? colorMap.amber}`}>
      <div>
        <span className="font-bold">{term}</span>
        <span className="text-[10px] ml-1 opacity-70">({meaning})</span>
      </div>
      <span className="font-mono text-[10px] opacity-60">{value}</span>
    </div>
  );
}

export default BahiaGlossary;
