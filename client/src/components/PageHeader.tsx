/**
 * PageHeader — cabeçalho padronizado para todas as páginas do sistema.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  [título da página]                                              │
 *   │  TEC502 - Concorrência...  (azul)                                │
 *   │  [SEMESTRE: 2026.1] [TURMA: TP01]  ← badges coloridos           │
 *   │  [slot de ação (botões)]                                         │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Props:
 *   title          — nome da página (ex: "Painel Geral")
 *   componentLabel — rótulo completo do componente (ex: "TEC502 - Concorrência e Conectividade")
 *   semester       — semestre selecionado (ex: "2026.1")
 *   classCode      — turma selecionada (ex: "TP01") — opcional
 *   showClass      — se false, oculta a turma mesmo que classCode exista (default: true)
 *   actions        — slot de botões/controles abaixo do cabeçalho
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
  const hasClass = showClass && classCode;
  const hasSemester = !!semester;

  return (
    <div className="flex flex-col gap-1 mb-6">
      <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
      {componentLabel && (
        <p className="text-sm font-semibold text-primary leading-tight">{componentLabel}</p>
      )}
      {(hasSemester || hasClass) && (
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {hasSemester && (
            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 tracking-wide">
              SEMESTRE: {semester}
            </span>
          )}
          {hasClass && (
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 tracking-wide">
              TURMA: {classCode}
            </span>
          )}
        </div>
      )}
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}
