import { describe, expect, it } from "vitest";

// Replicate the CSV generation logic from the router for testing
function generateGoogleWorkspaceCSV(
  studentsData: { studentName: string; studentEmail: string; semester: string }[]
) {
  const header = "First Name [Required];Last Name [Required];Email Address [Required];Password [Required];Password Hash Function [UPLOAD ONLY];Org Unit Path [Required];New Primary Email [UPLOAD ONLY];Recovery Email;Home Secondary Email;Work Secondary Email;Recovery Phone [MUST BE IN THE E.164 FORMAT];Work Phone;Home Phone;Mobile Phone;Work Address;Home Address;Employee ID;Employee Type;Employee Title;Manager Email;Department;Cost Center;Building ID;Floor Name;Floor Section;Change Password at Next Sign-In;New Status [UPLOAD ONLY];New Licenses [UPLOAD ONLY];Advanced Protection Program enrollment";

  const rows = studentsData.map(s => {
    const nameParts = s.studentName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const emailUser = s.studentEmail.split("@")[0] || "";
    const password = `${emailUser}${s.semester}`;
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
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", semester: "20262" },
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
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("ANTONIO"); // First Name
    expect(cols[1]).toBe("AUGUSTO TEIXEIRA RIBEIRO COUTINHO"); // Last Name
  });

  it("generates password as email username + semester", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[3]).toBe("aatrcoutinho20262"); // Password
  });

  it("sets Org Unit Path to /Alunos", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[5]).toBe("/Alunos");
  });

  it("sets Change Password at Next Sign-In to True", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[25]).toBe("True");
  });

  it("sets Advanced Protection Program enrollment to False", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[28]).toBe("False");
  });

  it("leaves unused columns empty", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "JOSE SANTOS", studentEmail: "jsantos@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    // Password Hash Function (index 4) should be empty
    expect(cols[4]).toBe("");
    // Recovery Email (index 7) should be empty
    expect(cols[7]).toBe("");
    // New Status (index 26) should be empty
    expect(cols[26]).toBe("");
  });

  it("exports multiple students correctly", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", semester: "20262" },
      { studentName: "JOSE MACEDO DOS SANTOS", studentEmail: "jmdsantos@ecomp.uefs.br", semester: "20262" },
      { studentName: "MARIA SILVA", studentEmail: "msilva@ecomp.uefs.br", semester: "20262" },
    ]);
    expect(result.count).toBe(3);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(4); // header + 3 students
  });

  it("deduplicates students by email", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", semester: "20262" },
      { studentName: "ANTONIO COUTINHO", studentEmail: "acoutinho@ecomp.uefs.br", semester: "20262" },
    ]);
    expect(result.count).toBe(1);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(2); // header + 1 student
  });

  it("each row has exactly 29 columns", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", studentEmail: "aatrcoutinho@ecomp.uefs.br", semester: "20262" },
      { studentName: "JOSE MACEDO DOS SANTOS JUNIOR", studentEmail: "jmdsantos@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    for (const line of lines) {
      const cols = line.split(";");
      expect(cols).toHaveLength(29);
    }
  });

  it("matches the expected format from usuarios-exemplos.csv", () => {
    // Based on the example: Antonio;Crispim Amorim Neto;acamorim@ecomp.uefs.br;acamorim20262;;/Alunos;;;;;;;;;;;;;;;;;;;;True;;;False
    const result = generateGoogleWorkspaceCSV([
      { studentName: "Antonio Crispim Amorim Neto", studentEmail: "acamorim@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("Antonio"); // First Name
    expect(cols[1]).toBe("Crispim Amorim Neto"); // Last Name
    expect(cols[2]).toBe("acamorim@ecomp.uefs.br"); // Email
    expect(cols[3]).toBe("acamorim20262"); // Password
    expect(cols[5]).toBe("/Alunos"); // Org Unit Path
    expect(cols[25]).toBe("True"); // Change Password
    expect(cols[28]).toBe("False"); // Advanced Protection
  });

  it("handles single-name students", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "MADONNA", studentEmail: "madonna@ecomp.uefs.br", semester: "20262" },
    ]);
    const lines = result.csv.split("\n");
    const cols = lines[1].split(";");
    expect(cols[0]).toBe("MADONNA"); // First Name
    expect(cols[1]).toBe(""); // Last Name (empty)
  });

  it("returns correct count", () => {
    const result = generateGoogleWorkspaceCSV([
      { studentName: "A B", studentEmail: "a@x.br", semester: "20262" },
      { studentName: "C D", studentEmail: "c@x.br", semester: "20262" },
      { studentName: "E F", studentEmail: "e@x.br", semester: "20262" },
    ]);
    expect(result.count).toBe(3);
  });
});
