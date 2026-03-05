import { createContext, useContext, useState, ReactNode } from "react";
import { getCurrentSemester } from "@/lib/semesterUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GlobalFilters {
  /** Selected component ID */
  selectedComponentId: number | null;
  /** Short code, e.g. "TEC502" */
  selectedComponentCode: string | null;
  /** Full label, e.g. "TEC502 - Concorrência e Conectividade" */
  selectedComponentFullLabel: string | null;
  /** Selected semester, e.g. "2026.1" */
  selectedSemester: string | null;
  /** Selected class ID */
  selectedClassId: number | null;
  /** Selected class code, e.g. "TP01" */
  selectedClassCode: string | null;
  /** Selected problem number, e.g. 1 */
  selectedProblemNumber: number | null;
  /** Selected session ID */
  selectedSessionId: number | null;
  /** Selected session number, e.g. 1 */
  selectedSessionNumber: number | null;
}

interface ComponentContextType extends GlobalFilters {
  setSelectedComponentId: (id: number | null) => void;
  setSelectedComponentMeta: (code: string | null, name: string | null) => void;
  setSelectedSemester: (semester: string | null) => void;
  setSelectedClass: (id: number | null, code: string | null) => void;
  setSelectedProblem: (problemNumber: number | null) => void;
  setSelectedSession: (sessionId: number | null, sessionNumber: number | null) => void;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  componentId: "gf-component-id",
  componentCode: "gf-component-code",
  componentName: "gf-component-name",
  semester: "gf-semester",
  classId: "gf-class-id",
  classCode: "gf-class-code",
  problemNumber: "gf-problem-number",
  sessionId: "gf-session-id",
  sessionNumber: "gf-session-number",
};

function readInt(key: string): number | null {
  const v = localStorage.getItem(key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
function readStr(key: string): string | null {
  return localStorage.getItem(key);
}
function saveInt(key: string, val: number | null) {
  if (val === null) localStorage.removeItem(key);
  else localStorage.setItem(key, String(val));
}
function saveStr(key: string, val: string | null) {
  if (val === null) localStorage.removeItem(key);
  else localStorage.setItem(key, val);
}

// ─── Default Context ──────────────────────────────────────────────────────────

const ComponentContext = createContext<ComponentContextType>({
  selectedComponentId: null,
  selectedComponentCode: null,
  selectedComponentFullLabel: null,
  selectedSemester: null,
  selectedClassId: null,
  selectedClassCode: null,
  selectedProblemNumber: null,
  selectedSessionId: null,
  selectedSessionNumber: null,
  setSelectedComponentId: () => {},
  setSelectedComponentMeta: () => {},
  setSelectedSemester: () => {},
  setSelectedClass: () => {},
  setSelectedProblem: () => {},
  setSelectedSession: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ComponentProvider({ children }: { children: ReactNode }) {
  // Component
  const [selectedComponentId, setSelectedComponentIdState] = useState<number | null>(
    () => readInt(KEYS.componentId)
  );
  const [selectedComponentCode, setSelectedComponentCodeState] = useState<string | null>(
    () => readStr(KEYS.componentCode)
  );
  const [selectedComponentName, setSelectedComponentNameState] = useState<string | null>(
    () => readStr(KEYS.componentName)
  );

  // Semester
  const [selectedSemester, setSelectedSemesterState] = useState<string | null>(
    () => readStr(KEYS.semester) ?? getCurrentSemester()
  );

  // Class
  const [selectedClassId, setSelectedClassIdState] = useState<number | null>(
    () => readInt(KEYS.classId)
  );
  const [selectedClassCode, setSelectedClassCodeState] = useState<string | null>(
    () => readStr(KEYS.classCode)
  );

  // Problem
  const [selectedProblemNumber, setSelectedProblemNumberState] = useState<number | null>(
    () => readInt(KEYS.problemNumber)
  );

  // Session
  const [selectedSessionId, setSelectedSessionIdState] = useState<number | null>(
    () => readInt(KEYS.sessionId)
  );
  const [selectedSessionNumber, setSelectedSessionNumberState] = useState<number | null>(
    () => readInt(KEYS.sessionNumber)
  );

  // Derived full label
  const selectedComponentFullLabel = selectedComponentCode
    ? (selectedComponentName
        ? `${selectedComponentCode} - ${selectedComponentName}`
        : selectedComponentCode)
    : null;

  // ── Setters ──────────────────────────────────────────────────────────────────

  const setSelectedComponentId = (id: number | null) => {
    setSelectedComponentIdState(id);
    saveInt(KEYS.componentId, id);
    if (id === null) {
      setSelectedComponentCodeState(null);
      setSelectedComponentNameState(null);
      saveStr(KEYS.componentCode, null);
      saveStr(KEYS.componentName, null);
      // Reset downstream filters
      setSelectedClassIdState(null);
      setSelectedClassCodeState(null);
      saveInt(KEYS.classId, null);
      saveStr(KEYS.classCode, null);
      setSelectedProblemNumberState(null);
      saveInt(KEYS.problemNumber, null);
      setSelectedSessionIdState(null);
      setSelectedSessionNumberState(null);
      saveInt(KEYS.sessionId, null);
      saveInt(KEYS.sessionNumber, null);
    }
  };

  const setSelectedComponentMeta = (code: string | null, name: string | null) => {
    setSelectedComponentCodeState(code);
    setSelectedComponentNameState(name);
    saveStr(KEYS.componentCode, code);
    saveStr(KEYS.componentName, name);
  };

  const setSelectedSemester = (semester: string | null) => {
    setSelectedSemesterState(semester);
    saveStr(KEYS.semester, semester);
    // Reset class/problem/session when semester changes
    setSelectedClassIdState(null);
    setSelectedClassCodeState(null);
    saveInt(KEYS.classId, null);
    saveStr(KEYS.classCode, null);
    setSelectedProblemNumberState(null);
    saveInt(KEYS.problemNumber, null);
    setSelectedSessionIdState(null);
    setSelectedSessionNumberState(null);
    saveInt(KEYS.sessionId, null);
    saveInt(KEYS.sessionNumber, null);
  };

  const setSelectedClass = (id: number | null, code: string | null) => {
    setSelectedClassIdState(id);
    setSelectedClassCodeState(code);
    saveInt(KEYS.classId, id);
    saveStr(KEYS.classCode, code);
    // Reset problem/session when class changes
    setSelectedProblemNumberState(null);
    saveInt(KEYS.problemNumber, null);
    setSelectedSessionIdState(null);
    setSelectedSessionNumberState(null);
    saveInt(KEYS.sessionId, null);
    saveInt(KEYS.sessionNumber, null);
  };

  const setSelectedProblem = (problemNumber: number | null) => {
    setSelectedProblemNumberState(problemNumber);
    saveInt(KEYS.problemNumber, problemNumber);
    // Reset session when problem changes
    setSelectedSessionIdState(null);
    setSelectedSessionNumberState(null);
    saveInt(KEYS.sessionId, null);
    saveInt(KEYS.sessionNumber, null);
  };

  const setSelectedSession = (sessionId: number | null, sessionNumber: number | null) => {
    setSelectedSessionIdState(sessionId);
    setSelectedSessionNumberState(sessionNumber);
    saveInt(KEYS.sessionId, sessionId);
    saveInt(KEYS.sessionNumber, sessionNumber);
  };

  return (
    <ComponentContext.Provider value={{
      selectedComponentId,
      selectedComponentCode,
      selectedComponentFullLabel,
      selectedSemester,
      selectedClassId,
      selectedClassCode,
      selectedProblemNumber,
      selectedSessionId,
      selectedSessionNumber,
      setSelectedComponentId,
      setSelectedComponentMeta,
      setSelectedSemester,
      setSelectedClass,
      setSelectedProblem,
      setSelectedSession,
    }}>
      {children}
    </ComponentContext.Provider>
  );
}

export function useComponentContext() {
  return useContext(ComponentContext);
}
