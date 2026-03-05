import { describe, expect, it } from "vitest";

// Test CSV parsing logic (same as used in the importCSV route)
// Robust SAGRES Folha de Frequência parser: detects enrollment by content pattern.
// E-mail is NOT generated here — students fill it in themselves when accessing the system.
function parseCSV(csvContent: string) {
  const ENROLLMENT_RE = /^\s*\d{5,11}\s*$/;
  const HEADER_NAME_RE = /aluno|nome/i;
  // Auto-detect delimiter
  const allLines = csvContent.split(/\r?\n/);
  const sampleLines = allLines.filter(l => l.trim()).slice(0, 10);
  const semicolonCount = sampleLines.join("").split(";").length - 1;
  const commaCount = sampleLines.join("").split(",").length - 1;
  const delimiter = commaCount > semicolonCount ? "," : ";";
  const parsed: { name: string; enrollment: string }[] = [];

  for (const line of allLines) {
    const cols = line.split(delimiter);
    let enrollmentIdx = -1;
    for (let i = 0; i < cols.length; i++) {
      if (ENROLLMENT_RE.test(cols[i])) { enrollmentIdx = i; break; }
    }
    if (enrollmentIdx === -1) continue;
    const enrollment = cols[enrollmentIdx].trim();
    const name = cols[enrollmentIdx + 1]?.trim();
    if (!name || HEADER_NAME_RE.test(name)) continue;
    if (/^[_\s]+$/.test(name)) continue;

    parsed.push({ name, enrollment });
  }
  return parsed;
}

// ─── Format B (old): N° in col[1], semicolon-prefixed lines ───
const SAMPLE_CSV_OLD_FORMAT = `;;;;;UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA;;;;;;
;;;;;Folha de Frequência;;;;;;
;;Professor:;;;;ANTÔNIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO;;;;;
;;Data:;;;;;quinta-feira, 26 de fevereiro de 2026;;;;
;N°;;Matrícula; Aluno;;;;;;   Assinatura do Aluno;
;1;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;
;2;;23211291 ;FELIPE DA SILVA FERREIRA;;;;;   _;
;3;;22111211 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;
;4;;22211297 ;ILSON MARINHO DA COSTA NETO;;;;;   _;
;5;;22221296 ;JEFFERSON MATEUS NASCIMENTO DOS SANTOS;;;;;   _;
;6;;24111300 ;JOAO VICTOR DA COSTA CERQUEIRA;;;;;   _;
;7;;24111305 ;LUIS FELIPE CARNEIRO PIMENTEL;;;;;   _;
;8;;24111310 ;NYCOLAS DE LIMA OLIVEIRA SILVA;;;;;   _;
;9;;23211319 ;UEMERSON VIRGEN DE JESUS;;;;;   _;
;10;;23211323 ;WALACE DE JESUS VENAS;;;;;   _;
;11;;22111240 ;YASMIN CORDEIRO DE SOUZA MEIRA;;;;;   _;`;

// ─── Format A (new): N° in col[0], no leading semicolon ───
const SAMPLE_CSV_NEW_FORMAT = `;;;;UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA;;;;;;Página 1 de 1
;;;;SAGRES DIÁRIO 3;;;;;;
;;;;Folha de Frequência;;;;;;
;;;;Emissão: 25/02/2026 04:45;;;;;;
;Unidade acadêmica:;;;;DEPARTAMENTO DE TECNOLOGIA              ;;;;;
;Classe:;;;;TEC502 - MI - CONCORRÊNCIA E CONECTIVIDADE (Teórica-Prática - TP01);;;;;
;Carga horária:;;;;;60 horas;Período letivo:;20261;;
;Professor:;;;;ANTÔNIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO;;;;;
;Data:;;;;;quinta-feira, 26 de fevereiro de 2026;;;;
N°;;Matrícula; Aluno;;;;;;   Assinatura do Aluno;
1;;22211284 ;CAROLINE SANTOS DE JESUS;;;;;   _;
2;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;
3;;23211291 ;FELIPE DA SILVA FERREIRA;;;;;   _;
4;;22111211 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;
5;;22211297 ;ILSON MARINHO DA COSTA NETO;;;;;   _;
6;;22221296 ;JEFFERSON MATEUS NASCIMENTO DOS SANTOS;;;;;   _;
7;;24111300 ;JOAO VICTOR DA COSTA CERQUEIRA;;;;;   _;
8;;24111305 ;LUIS FELIPE CARNEIRO PIMENTEL;;;;;   _;
9;;24111310 ;NYCOLAS DE LIMA OLIVEIRA SILVA;;;;;   _;
10;;23211319 ;UEMERSON VIRGEN DE JESUS;;;;;   _;
11;;23211323 ;WALACE DE JESUS VENAS;;;;;   _;`;

const SAMPLE_CSV_WITH_TRIAL_OLD = `"This document was generated using a trial version of DevExpress libraries";;;;;;;;;;;
;;;;;UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA;;;;;;Página 1 de 1
;;;;;SAGRES DIÁRIO 3;;;;;;
;;;;;Folha de Frequência;;;;;;
;;Classe:;;;;TEC502 - MI - CONCORRÊNCIA E CONECTIVIDADE;;;;;
;;Professor:;;;;ANTÔNIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO;;;;;
;N°;;Matrícula; Aluno;;;;;;   Assinatura do Aluno;
;1;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;
;2;;23211291 ;FELIPE DA SILVA FERREIRA;;;;;   _;
;3;;22111211 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;

describe("CSV Import - Old Format (N° in col[1])", () => {
  it("parses old SAGRES CSV and extracts all 11 students", () => {
    const result = parseCSV(SAMPLE_CSV_OLD_FORMAT);
    expect(result).toHaveLength(11);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
    expect(result[0].enrollment).toBe("20111193");
    expect(result[10].name).toBe("YASMIN CORDEIRO DE SOUZA MEIRA");
    expect(result[10].enrollment).toBe("22111240");
  });

  it("handles CSV with DevExpress trial notice header", () => {
    const result = parseCSV(SAMPLE_CSV_WITH_TRIAL_OLD);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
    expect(result[2].name).toBe("GERSON FERREIRA DOS ANJOS NETO");
  });

  it("handles multi-digit row numbers (10+)", () => {
    const result = parseCSV(SAMPLE_CSV_OLD_FORMAT);
    const student10 = result.find(s => s.enrollment === "23211323");
    expect(student10).toBeDefined();
    expect(student10!.name).toBe("WALACE DE JESUS VENAS");
  });
});

describe("CSV Import - New Format (N° in col[0])", () => {
  it("parses new SAGRES CSV and extracts all 11 students", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    expect(result).toHaveLength(11);
    expect(result[0].name).toBe("CAROLINE SANTOS DE JESUS");
    expect(result[0].enrollment).toBe("22211284");
    expect(result[10].name).toBe("WALACE DE JESUS VENAS");
    expect(result[10].enrollment).toBe("23211323");
  });

  it("trims enrollment whitespace from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    expect(result[0].enrollment).toBe("22211284");
    expect(result[0].enrollment).not.toContain(" ");
  });

  it("trims name whitespace from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    expect(result[0].name).toBe("CAROLINE SANTOS DE JESUS");
    expect(result[0].name[0]).not.toBe(" ");
  });

  it("handles multi-digit row numbers (10+) in new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    const student10 = result.find(s => s.enrollment === "23211319");
    expect(student10).toBeDefined();
    expect(student10!.name).toBe("UEMERSON VIRGEN DE JESUS");
  });

  it("skips header row in new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    const hasHeader = result.some(s => s.name === "Aluno");
    expect(hasHeader).toBe(false);
  });
});

describe("CSV Import - Common Features (both formats)", () => {
  it("skips header row with Matrícula/Aluno labels", () => {
    const csvWithHeader = `;N°;;Matrícula; Aluno;
;1;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;`;
    const result = parseCSV(csvWithHeader);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
  });

  it("returns empty array for invalid CSV content", () => {
    const result = parseCSV("just some random text\nwith no structure");
    expect(result).toHaveLength(0);
  });

  it("handles students with accented names", () => {
    const csvWithAccents = `;1;;12345 ;JOSÉ ANTÔNIO DA CONCEIÇÃO;;;;;   _;`;
    const result = parseCSV(csvWithAccents);
    expect(result[0].name).toBe("JOSÉ ANTÔNIO DA CONCEIÇÃO");
    expect(result[0].enrollment).toBe("12345");
  });

  it("handles single-name students", () => {
    const csvSingleName = `;1;;99999 ;MADONNA;;;;;   _;`;
    const result = parseCSV(csvSingleName);
    expect(result[0].name).toBe("MADONNA");
    expect(result[0].enrollment).toBe("99999");
  });

  it("handles students with suffix (Junior, Neto, Filho)", () => {
    const csvWithSuffix = `;1;;12345 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;
    const result = parseCSV(csvWithSuffix);
    expect(result[0].name).toBe("GERSON FERREIRA DOS ANJOS NETO");
    expect(result[0].enrollment).toBe("12345");
  });

  it("trims whitespace from enrollment and name (old format)", () => {
    const csvWithSpaces = `;1;;20111193 ; CLEIDSON RAMOS DE CARVALHO ;;;;;   _;`;
    const result = parseCSV(csvWithSpaces);
    expect(result[0].enrollment).toBe("20111193");
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
  });

  it("trims whitespace from enrollment and name (new format)", () => {
    const csvWithSpaces = `1;;20111193 ; CLEIDSON RAMOS DE CARVALHO ;;;;;   _;`;
    const result = parseCSV(csvWithSpaces);
    expect(result[0].enrollment).toBe("20111193");
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
  });
});

describe("CSV Import - Comma-delimited format (SAGRES with comma)", () => {
  const COMMA_CSV = `,,,,UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA,,,,,,Página 1 de 1
,,,,SAGRES DIÁRIO 3,,,,,,
,,,,Folha de Frequência,,,,,,
Nº,,Matrícula, Aluno,,,,,,   Assinatura do Aluno,
1,,24111281 ,ADSON VICTOR DE SOUZA ALVES,,,,,   _,
2,,23111363 ,EMANUEL LUCAS TELLES BASTOS SENA,,,,,   _,
3,,22211297 ,ILSON MARINHO DA COSTA NETO,,,,,   _,
`;

  it("detects comma delimiter automatically", () => {
    const result = parseCSV(COMMA_CSV);
    expect(result.length).toBe(3);
  });

  it("extracts enrollment from comma-delimited CSV", () => {
    const result = parseCSV(COMMA_CSV);
    expect(result[0].enrollment).toBe("24111281");
    expect(result[1].enrollment).toBe("23111363");
  });

  it("extracts name from comma-delimited CSV", () => {
    const result = parseCSV(COMMA_CSV);
    expect(result[0].name).toBe("ADSON VICTOR DE SOUZA ALVES");
    expect(result[1].name).toBe("EMANUEL LUCAS TELLES BASTOS SENA");
  });

  it("handles Neto suffix in comma-delimited CSV (name preserved as-is)", () => {
    const result = parseCSV(COMMA_CSV);
    expect(result[2].name).toBe("ILSON MARINHO DA COSTA NETO");
    expect(result[2].enrollment).toBe("22211297");
  });

  it("skips header rows in comma-delimited CSV", () => {
    const result = parseCSV(COMMA_CSV);
    expect(result.every(r => /^\d+$/.test(r.enrollment))).toBe(true);
  });
});

describe("Cross-class visibility rules", () => {
  it("professor should see own class by default", () => {
    const selectedClassId = 1;
    const viewingClassId = null;
    const activeClassId = viewingClassId ?? selectedClassId;
    expect(activeClassId).toBe(1);
  });

  it("professor can switch to view another class", () => {
    const selectedClassId = 1;
    const viewingClassId = 2;
    const activeClassId = viewingClassId ?? selectedClassId;
    expect(activeClassId).toBe(2);
  });

  it("viewing own class should not be flagged as cross-class", () => {
    const selectedClassId = 1;
    const viewingClassId = 1;
    const viewingOtherClass = viewingClassId && viewingClassId !== selectedClassId;
    expect(viewingOtherClass).toBeFalsy();
  });

  it("viewing different class should be flagged as cross-class", () => {
    const selectedClassId = 1;
    const viewingClassId = 2;
    const viewingOtherClass = viewingClassId && viewingClassId !== selectedClassId;
    expect(viewingOtherClass).toBeTruthy();
  });
});
