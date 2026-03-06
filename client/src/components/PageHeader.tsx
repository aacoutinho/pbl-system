/**
 * PageHeader — cabeçalho padronizado para todas as páginas do sistema.
 *
 * Layout por página:
 *
 *  Painel Geral / Turmas (showClass=false):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [título da página]                                  │
 *   │  TEC502 - Concorrência...  (azul)                    │
 *   │  SEMESTRE: 2026.1          (preto, mesmo tamanho)    │
 *   │  [slot de ação (botões)]                             │
 *   └──────────────────────────────────────────────────────┘
 *
 *  Alunos / Sessões / Avaliar Tutorial / Resultados (showClass=true):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [título da página]                                  │
 *   │  TEC502 - Concorrência...  (azul)                    │
 *   │  TURMA: TP01 - SEMESTRE: 2026.1  (preto)             │
 *   │  [slot de ação (botões)]                             │
 *   └──────────────────────────────────────────────────────┘
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
  // Linha de contexto abaixo do componente (semestre e/ou turma)
  const hasClass = showClass && classCode;
  const hasSemester = !!semester;

  let contextLine: string | null = null;
  if (hasClass && hasSemester) {
    contextLine = `TURMA: ${classCode} - SEMESTRE: ${semester}`;
  } else if (hasClass) {
    contextLine = `TURMA: ${classCode}`;
  } else if (hasSemester) {
    contextLine = `SEMESTRE: ${semester}`;
  }

  return (
    <div className="flex flex-col gap-0.5 mb-6">
      <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
      {componentLabel && (
        <p className="text-sm font-semibold text-primary leading-tight">{componentLabel}</p>
      )}
      {contextLine && (
        <p className="text-sm font-semibold text-foreground leading-tight">{contextLine}</p>
      )}
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}
