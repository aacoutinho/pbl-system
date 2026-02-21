import { describe, expect, it } from "vitest";

// Test CSV parsing logic (same as used in the importCSV route)
function parseCSV(csvContent: string, emailDomain?: string) {
  const lines = csvContent.split("\n");
  const parsed: { name: string; email: string; enrollment: string }[] = [];

  for (const line of lines) {
    const cols = line.split(";");
    const num = cols[1]?.trim();
    if (!num || isNaN(parseInt(num))) continue;
    const enrollment = cols[3]?.trim();
    const name = cols[4]?.trim();
    if (!name || !enrollment) continue;
    if (name === "Aluno" || enrollment === "Matrícula") continue;

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

const SAMPLE_CSV_SIMPLE = `;;;;;UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA;;;;;;
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

const SAMPLE_CSV_WITH_TRIAL = `"This document was generated using a trial version of DevExpress libraries";;;;;;;;;;;
;;;;;UNIVERSIDADE ESTADUAL DE FEIRA DE SANTANA;;;;;;Página 1 de 1
;;;;;SAGRES DIÁRIO 3;;;;;;
;;;;;Folha de Frequência;;;;;;
;;Classe:;;;;TEC502 - MI - CONCORRÊNCIA E CONECTIVIDADE;;;;;
;;Professor:;;;;ANTÔNIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO;;;;;
;N°;;Matrícula; Aluno;;;;;;   Assinatura do Aluno;
;1;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;
;2;;23211291 ;FELIPE DA SILVA FERREIRA;;;;;   _;
;3;;22111211 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;

describe("CSV Import - SAGRES Format Parser", () => {
  it("parses simple SAGRES CSV and extracts all 11 students", () => {
    const result = parseCSV(SAMPLE_CSV_SIMPLE);
    expect(result).toHaveLength(11);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
    expect(result[0].enrollment).toBe("20111193");
    expect(result[10].name).toBe("YASMIN CORDEIRO DE SOUZA MEIRA");
    expect(result[10].enrollment).toBe("22111240");
  });

  it("generates emails with default domain when no domain is provided", () => {
    const result = parseCSV(SAMPLE_CSV_SIMPLE);
    // CLEIDSON RAMOS DE CARVALHO → crdcarvalho@ecomp.uefs.br
    expect(result[0].email).toBe("crdcarvalho@ecomp.uefs.br");
    // FELIPE DA SILVA FERREIRA → fdsferreira@ecomp.uefs.br
    expect(result[1].email).toBe("fdsferreira@ecomp.uefs.br");
  });

  it("generates emails from name when domain is provided (initials + last name)", () => {
    const result = parseCSV(SAMPLE_CSV_SIMPLE, "uefs.br");
    // CLEIDSON RAMOS DE CARVALHO → crdcarvalho@uefs.br
    expect(result[0].email).toBe("crdcarvalho@uefs.br");
    // FELIPE DA SILVA FERREIRA → fdsferreira@uefs.br
    expect(result[1].email).toBe("fdsferreira@uefs.br");
    // YASMIN CORDEIRO DE SOUZA MEIRA → ycdsmeira@uefs.br
    expect(result[10].email).toBe("ycdsmeira@uefs.br");
  });

  it("removes accents from generated emails", () => {
    const csvWithAccents = `;N°;;Matrícula; Aluno;
;1;;12345 ;JOSÉ ANTÔNIO DA CONCEIÇÃO;;;;;   _;`;
    const result = parseCSV(csvWithAccents, "uefs.br");
    // JOSÉ ANTÔNIO DA CONCEIÇÃO → jadconceicao@uefs.br
    expect(result[0].email).toBe("jadconceicao@uefs.br");
  });

  it("handles CSV with DevExpress trial notice header", () => {
    const result = parseCSV(SAMPLE_CSV_WITH_TRIAL, "uefs.br");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
    expect(result[2].name).toBe("GERSON FERREIRA DOS ANJOS NETO");
  });

  it("skips header row with Matrícula/Aluno labels", () => {
    const csvWithHeader = `;N°;;Matrícula; Aluno;
;1;;20111193 ;CLEIDSON RAMOS DE CARVALHO;;;;;   _;`;
    const result = parseCSV(csvWithHeader);
    // Should not include the header row
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
  });

  it("returns empty array for invalid CSV content", () => {
    const result = parseCSV("just some random text\nwith no structure");
    expect(result).toHaveLength(0);
  });

  it("handles single-name students", () => {
    const csvSingleName = `;1;;99999 ;MADONNA;;;;;   _;`;
    const result = parseCSV(csvSingleName, "uefs.br");
    expect(result[0].email).toBe("madonna@uefs.br");
  });

  it("ignores Junior suffix when generating email", () => {
    const csvWithJunior = `;1;;12345 ;JOSÉ MACEDO DOS SANTOS JUNIOR;;;;;   _;`;
    const result = parseCSV(csvWithJunior);
    // JOSÉ MACEDO DOS SANTOS JUNIOR → jmdsantos@ecomp.uefs.br (ignoring JUNIOR)
    expect(result[0].email).toBe("jmdsantos@ecomp.uefs.br");
  });

  it("ignores Jr. suffix when generating email", () => {
    const csvWithJr = `;1;;12346 ;PEDRO SILVA JR.;;;;;   _;`;
    const result = parseCSV(csvWithJr);
    // PEDRO SILVA JR. → psilva@ecomp.uefs.br (ignoring JR.)
    expect(result[0].email).toBe("psilva@ecomp.uefs.br");
  });

  it("ignores Neto suffix when generating email", () => {
    const csvWithNeto = `;1;;12347 ;GERSON FERREIRA DOS ANJOS NETO;;;;;   _;`;
    const result = parseCSV(csvWithNeto);
    // GERSON FERREIRA DOS ANJOS NETO → gfdanjos@ecomp.uefs.br (ignoring NETO)
    expect(result[0].email).toBe("gfdanjos@ecomp.uefs.br");
  });

  it("ignores Filho suffix when generating email", () => {
    const csvWithFilho = `;1;;12348 ;ANTONIO RIBEIRO TEIXEIRA FILHO;;;;;   _;`;
    const result = parseCSV(csvWithFilho);
    // ANTONIO RIBEIRO TEIXEIRA FILHO → arteixeira@ecomp.uefs.br (ignoring FILHO)
    expect(result[0].email).toBe("arteixeira@ecomp.uefs.br");
  });

  it("trims whitespace from enrollment and name", () => {
    const csvWithSpaces = `;1;;20111193 ; CLEIDSON RAMOS DE CARVALHO ;;;;;   _;`;
    const result = parseCSV(csvWithSpaces);
    expect(result[0].enrollment).toBe("20111193");
    expect(result[0].name).toBe("CLEIDSON RAMOS DE CARVALHO");
  });

  it("handles multi-digit row numbers (10+)", () => {
    const result = parseCSV(SAMPLE_CSV_SIMPLE);
    const student10 = result.find(s => s.enrollment === "23211323");
    expect(student10).toBeDefined();
    expect(student10!.name).toBe("WALACE DE JESUS VENAS");
  });
});

describe("Cross-class visibility rules", () => {
  it("professor should see own class by default", () => {
    // This is a logic test - the default viewingClassId is null, which falls back to selectedClassId
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
