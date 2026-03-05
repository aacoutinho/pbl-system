/**
 * PageHeader — cabeçalho padronizado para todas as páginas do sistema.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [título da página]          Semestre: 2026.1        │
 *   │  TEC502 - Concorrência...    Turma: TP01             │
 *   │  [slot de ação (botões)]                             │
 *   └──────────────────────────────────────────────────────┘
 *
 * Props:
 *   title       — nome da página (ex: "Painel Geral")
 *   componentLabel — rótulo completo do componente (ex: "TEC502 - Concorrência e Conectividade")
 *   semester    — semestre selecionado (ex: "2026.1")
 *   classCode   — turma selecionada (ex: "TP01") — opcional
 *   showClass   — se false, oculta a linha de turma mesmo que classCode exista (default: true)
 *   actions     — slot de botões/controles no canto inferior esquerdo
 */

import React from "react";

interface PageHeaderProps {
  title: string;
  componentLabel?: string | null;
  semester?: string | null;
  classCode?: string | null;
  showClass?: boolean;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  componentLabel,
  semester,
  classCode,
  showClass = true,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      {/* Esquerda: título + componente + ações */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
        {componentLabel && (
          <p className="text-sm font-semibold text-primary leading-tight">{componentLabel}</p>
        )}
        {actions && <div className="mt-3">{actions}</div>}
      </div>

      {/* Direita: semestre + turma */}
      {(semester || (showClass && classCode)) && (
        <div className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
          {semester && (
            <span className="text-xs font-medium text-muted-foreground">
              Semestre: <strong className="text-foreground">{semester}</strong>
            </span>
          )}
          {showClass && classCode && (
            <span className="text-xs font-medium text-muted-foreground">
              Turma: <strong className="text-foreground">{classCode}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
