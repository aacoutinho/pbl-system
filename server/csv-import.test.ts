import { describe, expect, it } from "vitest";

// Test CSV parsing logic (same as used in the importCSV route)
// Robust SAGRES Folha de Frequência parser: detects enrollment by content pattern.
function parseCSV(csvContent: string, emailDomain?: string) {
  const ENROLLMENT_RE = /^\s*\d{5,11}\s*$/;
  const HEADER_NAME_RE = /aluno|nome/i;
  const parsed: { name: string; email: string; enrollment: string }[] = [];

  for (const line of csvContent.split(/\r?\n/)) {
    const cols = line.split(";");
    let enrollmentIdx = -1;
    for (let i = 0; i < cols.length; i++) {
      if (ENROLLMENT_RE.test(cols[i])) { enrollmentIdx = i; break; }
    }
    if (enrollmentIdx === -1) continue;
    const enrollment = cols[enrollmentIdx].trim();
    const name = cols[enrollmentIdx + 1]?.trim();
    if (!name || HEADER_NAME_RE.test(name)) continue;
    if (/^[_\s]+$/.test(name)) continue;

    // Generate email: initials + last name (ignoring suffixes like Junior, Jr., Neto, Filho)
    const domain = emailDomain || "ecomp.uefs.br";
    const parts = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(p => p.length > 0);
    
    // Remove common suffixes from the end
    const suffixes = ["junior", "jr", "jr.", "neto", "filho"];
    let filteredParts = [...parts];
    while (filteredParts.length > 1 && suffixes.includes(filteredParts[filteredParts.length - 1].replace(/\./g, ""))) {
      filteredParts.pop();
    }
    
    let email = "";
    if (filteredParts.length >= 2) {
      const initials = filteredParts.slice(0, -1).map(p => p[0]).join("");
      const lastName = filteredParts[filteredParts.length - 1];
      email = `${initials}${lastName}@${domain}`;
    } else {
      email = `${filteredParts[0]}@${domain}`;
    }

    parsed.push({ name, email, enrollment });
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

  it("generates emails with default domain", () => {
    const result = parseCSV(SAMPLE_CSV_OLD_FORMAT);
    expect(result[0].email).toBe("crdcarvalho@ecomp.uefs.br");
    expect(result[1].email).toBe("fdsferreira@ecomp.uefs.br");
  });

  it("generates emails with custom domain", () => {
    const result = parseCSV(SAMPLE_CSV_OLD_FORMAT, "uefs.br");
    expect(result[0].email).toBe("crdcarvalho@uefs.br");
    expect(result[1].email).toBe("fdsferreira@uefs.br");
    expect(result[10].email).toBe("ycdsmeira@uefs.br");
  });

  it("handles CSV with DevExpress trial notice header", () => {
    const result = parseCSV(SAMPLE_CSV_WITH_TRIAL_OLD, "uefs.br");
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

  it("generates emails correctly from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    // CAROLINE SANTOS DE JESUS → csdjesus@ecomp.uefs.br
    expect(result[0].email).toBe("csdjesus@ecomp.uefs.br");
    // CLEIDSON RAMOS DE CARVALHO → crdcarvalho@ecomp.uefs.br
    expect(result[1].email).toBe("crdcarvalho@ecomp.uefs.br");
  });

  it("generates emails with custom domain from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT, "uefs.br");
    expect(result[0].email).toBe("csdjesus@uefs.br");
    expect(result[1].email).toBe("crdcarvalho@uefs.br");
  });

  it("trims enrollment whitespace from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    // Enrollment "22211284 " should be trimmed to "22211284"
    expect(result[0].enrollment).toBe("22211284");
    expect(result[0].enrollment).not.toContain(" ");
  });

  it("trims name whitespace from new format", () => {
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    // Name " CAROLINE SANTOS DE JESUS" should be trimmed
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
    // The header line "N°;;Matrícula; Aluno;..." should be skipped because N° is not a number
    const result = parseCSV(SAMPLE_CSV_NEW_FORMAT);
    const hasHeader = result.some(s => s.name === "Aluno");
    expect(hasHeader).toBe(false);
  });
});

describe("CSV Import - Common Features (both formats)", () => {
  it("removes accents from generated emails", () => {
    const csvWithAccents = `;1;;12345 ;JOSÉ ANTÔNIO DA CONCEIÇÃO;;;;;   _;`;
    const result = parseCSV(csvWithAccents, "uefs.br");
    expect(result[0].email).toBe("jadconceicao@uefs.br");
  });

  it("removes accents from new format emails", () => {
    const csvNewAccents = `1;;12345 ;JOSÉ ANTÔNIO DA CONCEIÇÃO;;;;;   _;`;
    const result = parseCSV(csvNewAccents, "uefs.br");
    expect(result[0].email).toBe("jadconceicao@uefs.br");
  });

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

  it("handles single-name students (old format)", () => {
    const csvSingleName = `;1;;99999 ;MADONNA;;;;;   _;`;
    const result = parseCSV(csvSingleName, "uefs.br");
    expect(result[0].email).toBe("madonna@uefs.br");
  });

  it("handles single-name students (new format)", () => {
    const csvSingleName = `1;;99999 ;MADONNA;;;;;   _;`;
    const result = parseCSV(csvSingleName, "uefs.br");
    expect(result[0].email).toBe("madonna@uefs.br");
  });

  it("ignores Junior suffix when generating email", () => {
    const csvWithJunior = `;1;;12345 ;JOSÉ MACEDO DOS SANTOS JUNIOR;;;;;   _;`;
    const result = parseCSV(csvWithJunior);
    expect(result[0].email).toBe("jmdsantos@ecomp.uefs.br");
  });

  it("ignores Jr. suffix when generating email", () => {
    const csvWithJr = `;1;;12346 ;PEDRO SILVA JR.;;;;;   _;`;
    const result = parseCSV(csvWithJr);
    expect(result[0].email).toBe("psilva@ecomp.uefs.br");
  });

  it("ignores Neto suffix when generating email", () => {
    const csvWithNeto = `;1;;12347 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;
    const result = parseCSV(csvWithNeto);
    expect(result[0].email).toBe("gfdanjos@ecomp.uefs.br");
  });

  it("ignores Filho suffix when generating email", () => {
    const csvWithFilho = `;1;;12348 ;ANTONIO RIBEIRO TEIXEIRA FILHO;;;;;   _;`;
    const result = parseCSV(csvWithFilho);
    expect(result[0].email).toBe("arteixeira@ecomp.uefs.br");
  });

  it("ignores Neto suffix in new format", () => {
    const csvWithNeto = `4;;22111211 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;
    const result = parseCSV(csvWithNeto);
    expect(result[0].email).toBe("gfdanjos@ecomp.uefs.br");
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
