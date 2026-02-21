import { describe, expect, it } from "vitest";

// Replicate the CSV generation logic from the router for testing
function generateGoogleWorkspaceCSV(
  studentsData: { studentName: string; studentEmail: string; studentEnrollment: string | null; semester: string }[]
) {
  const header = "First Name [Required];Last Name [Required];Email Address [Required];Password [Required];Password Hash Function [UPLOAD ONLY];Org Unit Path [Required];New Primary Email [UPLOAD ONLY];Recovery Email;Home Secondary Email;Work Secondary Email;Recovery Phone [MUST BE IN THE E.164 FORMAT];Work Phone;Home Phone;Mobile Phone;Work Address;Home Address;Employee ID;Employee Type;Employee Title;Manager Email;Department;Cost Center;Building ID;Floor Name;Floor Section;Change Password at Next Sign-In;New Status [UPLOAD ONLY];New Licenses [UPLOAD ONLY];Advanced Protection Program enrollment";

  const rows = studentsData.map(s => {
    const nameParts = s.studentName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
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

  it("splits name into first name and last name correctly", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("ANTONIO"); // First Name
    expect(cols[1]).toBe("AUGUSTO TEIXEIRA RIBEIRO COUTINHO"); // Last Name
  });

  it("generates password as iniciais_nome + matrícula", () => {
    // ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO → iniciais: a+a+t+r+c = "aatrc", matrícula: 20221001
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("aatrc20221001"); // Password = iniciais + matrícula
  });

  it("generates password for two-name student", () => {
    // JOSE SANTOS → iniciais: j+s = "js", matrícula: 20220505
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
    expect(cols[3]).toBe("js"); // Only initials, no enrollment
  });

  it("generates password for student with many names", () => {
    // JOSE MACEDO DOS SANTOS JUNIOR → iniciais: j+m+d+s+j = "jmdsj"
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
    expect(cols[4]).toBe(""); // Password Hash Function
    expect(cols[7]).toBe(""); // Recovery Email
    expect(cols[26]).toBe(""); // New Status
  });

  it("exports multiple students correctly", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
      { studentName: "JOSE MACEDO DOS SANTOS", studentEmail: "jmdsantos@ecomp.uefs.br", studentEnrollment: "20221002", semester: "20262" },
      { studentName: "MARIA SILVA", studentEmail: "msilva@ecomp.uefs.br", studentEnrollment: "20221003", semester: "20262" },
    ]);
    expect(result.count).toBe(3);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(4); // header + 3 students
  });

  it("deduplicates students by email", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", studentEnrollment: "20221001", semester: "20262" },
    ]);
    expect(result.count).toBe(1);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(2); // header + 1 student
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

  it("matches the expected format structure", () => {
    // Antonio Crispim Amorim Neto → iniciais: a+c+a+n = "acan", matrícula: 20230303
    const result = generateGoogleWorkspaceCSV([
      { studentName: "Antonio Crispim Amorim Neto", studentEmail: "acamorim@ecomp.uefs.br", studentEnrollment: "20230303", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Antonio"); // First Name
    expect(cols[1]).toBe("Crispim Amorim Neto"); // Last Name
    expect(cols[2]).toBe("acamorim@ecomp.uefs.br"); // Email
    expect(cols[3]).toBe("acan20230303"); // Password = iniciais + matrícula
    expect(cols[5]).toBe("/Alunos");
    expect(cols[25]).toBe("True");
    expect(cols[28]).toBe("False");
  });

  it("handles single-name students", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "MADONNA", studentEmail: "madonna@ecomp.uefs.br", studentEnrollment: "20221099", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("MADONNA"); // First Name
    expect(cols[1]).toBe(""); // Last Name (empty)
    expect(cols[3]).toBe("m20221099"); // Password = "m" + matrícula
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
