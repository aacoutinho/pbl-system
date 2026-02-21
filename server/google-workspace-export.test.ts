import { describe, expect, it } from "vitest";

// Title Case: primeira letra maiúscula, resto minúscula
const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// Replicate the CSV generation logic from the router for testing
function generateGoogleWorkspaceCSV(
  studentsData: { studentName: string; studentEmail: string; studentEnrollment: string | null; semester: string }[]
) {
  const header = "First Name [Required];Last Name [Required];Email Address [Required];Password [Required];Password Hash Function [UPLOAD ONLY];Org Unit Path [Required];New Primary Email [UPLOAD ONLY];Recovery Email;Home Secondary Email;Work Secondary Email;Recovery Phone [MUST BE IN THE E.164 FORMAT];Work Phone;Home Phone;Mobile Phone;Work Address;Home Address;Employee ID;Employee Type;Employee Title;Manager Email;Department;Cost Center;Building ID;Floor Name;Floor Section;Change Password at Next Sign-In;New Status [UPLOAD ONLY];New Licenses [UPLOAD ONLY];Advanced Protection Program enrollment";

  const rows = studentsData.map(s => {
    const nameParts = s.studentName.trim().split(/\s+/);
    const firstName = toTitleCase(nameParts[0] || "");
    const lastName = toTitleCase(nameParts.slice(1).join(" ") || "");
    // Password: iniciais do nome + matrícula
    const initials = nameParts.map(p => p[0]?.toLowerCase() || "").join("");
    const enrollment = s.studentEnrollment || "";
    const password = `${initials}${enrollment}`;
    return [
      firstName, lastName, s.studentEmail, password,
      "", "/Alunos", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
      "True", "", "", "False",
    ].join(";");
  });

  // Deduplicate by email
  const seen = new Set<string>();
  const uniqueRows = rows.filter(row => {
    const email = row.split(";")[2];
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  return { csv: [header, ...uniqueRows].join("\n"), count: uniqueRows.length };
}

describe("Google Workspace CSV Export", () => {
  it("generates CSV with correct header (29 columns, semicolon-separated)", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const headerCols = lines[0].split(";");
    expect(headerCols).toHaveLength(29);
    expect(headerCols[0]).toBe("First Name [Required]");
    expect(headerCols[1]).toBe("Last Name [Required]");
    expect(headerCols[2]).toBe("Email Address [Required]");
    expect(headerCols[3]).toBe("Password [Required]");
    expect(headerCols[5]).toBe("Org Unit Path [Required]");
    expect(headerCols[25]).toBe("Change Password at Next Sign-In");
    expect(headerCols[28]).toBe("Advanced Protection Program enrollment");
  });

  it("formats names in Title Case from UPPERCASE input", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Antonio"); // First Name in Title Case
    expect(cols[1]).toBe("Augusto Teixeira Ribeiro Coutinho"); // Last Name in Title Case
  });

  it("formats names in Title Case from lowercase input", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "jose macedo dos santos", studentEmail: "jmdsantos@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Jose");
    expect(cols[1]).toBe("Macedo Dos Santos");
  });

  it("preserves Title Case from mixed case input", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "Antonio Crispim Amorim Neto", studentEmail: "acamorim@ecomp.uefs.br", studentEnrollment: "20230303", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Antonio");
    expect(cols[1]).toBe("Crispim Amorim Neto");
  });

  it("generates password as iniciais_nome + matrícula", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("aatrc20221001");
  });

  it("generates password for two-name student", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: "20220505", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("js20220505");
  });

  it("generates password with empty enrollment when missing", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: null, semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("js");
  });

  it("generates password for student with many names", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE MACEDO DOS SANTOS JUNIOR", studentEmail: "jmdsantos@ecomp.uefs.br", studentEnrollment: "20230101", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("jmdsj20230101");
  });

  it("sets Org Unit Path to /Alunos", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: "20220505", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[5]).toBe("/Alunos");
  });

  it("sets Change Password at Next Sign-In to True", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: "20220505", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[25]).toBe("True");
  });

  it("sets Advanced Protection Program enrollment to False", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: "20220505", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[28]).toBe("False");
  });

  it("leaves unused columns empty", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", studentEnrollment: "20220505", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[4]).toBe("");
    expect(cols[7]).toBe("");
    expect(cols[26]).toBe("");
  });

  it("exports multiple students correctly with Title Case", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
      { studentName: "JOSE MACEDO DOS SANTOS", studentEmail: "jmdsantos@ecomp.uefs.br", studentEnrollment: "20221002", semester: "20262" },
      { studentName: "MARIA SILVA", studentEmail: "msilva@ecomp.uefs.br", studentEnrollment: "20221003", semester: "20262" },
    ]);
    expect(result.count).toBe(3);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(4);
    // Verify Title Case on all rows
    expect(lines[1].split(";")[0]).toBe("Antonio");
    expect(lines[2].split(";")[0]).toBe("Jose");
    expect(lines[3].split(";")[0]).toBe("Maria");
  });

  it("deduplicates students by email", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    expect(result.count).toBe(1);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(2);
  });

  it("each row has exactly 29 columns", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
      { studentName: "JOSE MACEDO DOS SANTOS JUNIOR", studentEmail: "jmdsantos@ecomp.uefs.br", studentEnrollment: "20221002", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    for (const line of lines) {
      const cols = line.split(";");
      expect(cols).toHaveLength(29);
    }
  });

  it("handles single-name students in Title Case", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "MADONNA", studentEmail: "madonna@ecomp.uefs.br", studentEnrollment: "20221099", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Madonna"); // Title Case
    expect(cols[1]).toBe("");
    expect(cols[3]).toBe("m20221099");
  });

  it("returns correct count", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "A B", studentEmail: "a@x.br", studentEnrollment: "001", semester: "20262" },
      { studentName: "C D", studentEmail: "c@x.br", studentEnrollment: "002", semester: "20262" },
      { studentName: "E F", studentEmail: "e@x.br", studentEnrollment: "003", semester: "20262" },
    ]);
    expect(result.count).toBe(3);
  });
});
