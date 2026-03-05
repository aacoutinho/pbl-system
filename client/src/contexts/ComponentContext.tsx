import { createContext, useContext, useState, ReactNode } from "react";
import { getCurrentSemester } from "@/lib/semesterUtils";

interface ComponentContextType {
  selectedComponentId: number | null;
  setSelectedComponentId: (id: number | null) => void;
  selectedSemester: string | null;
  setSelectedSemester: (semester: string | null) => void;
  /** Short code, e.g. "TEC502" */
  selectedComponentCode: string | null;
  /** Full label, e.g. "TEC502 - Concorrência e Conectividade" */
  selectedComponentFullLabel: string | null;
  setSelectedComponentMeta: (code: string | null, name: string | null) => void;
}

const ComponentContext = createContext<ComponentContextType>({
  selectedComponentId: null,
  setSelectedComponentId: () => {},
  selectedSemester: null,
  setSelectedSemester: () => {},
  selectedComponentCode: null,
  selectedComponentFullLabel: null,
  setSelectedComponentMeta: () => {},
});

const COMPONENT_STORAGE_KEY = "selected-component-id";
const SEMESTER_STORAGE_KEY = "selected-semester";

export function ComponentProvider({ children }: { children: ReactNode }) {
  const [selectedComponentId, setSelectedComponentIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(COMPONENT_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  const [selectedSemester, setSelectedSemesterState] = useState<string | null>(() => {
    return localStorage.getItem(SEMESTER_STORAGE_KEY) ?? getCurrentSemester();
  });

  const [selectedComponentCode, setSelectedComponentCode] = useState<string | null>(null);
  const [selectedComponentName, setSelectedComponentName] = useState<string | null>(null);

  const selectedComponentFullLabel = selectedComponentCode
    ? (selectedComponentName ? `${selectedComponentCode} - ${selectedComponentName}` : selectedComponentCode)
    : null;

  const setSelectedComponentId = (id: number | null) => {
    setSelectedComponentIdState(id);
    if (id !== null) {
      localStorage.setItem(COMPONENT_STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(COMPONENT_STORAGE_KEY);
      setSelectedComponentCode(null);
      setSelectedComponentName(null);
    }
  };

  const setSelectedSemester = (semester: string | null) => {
    setSelectedSemesterState(semester);
    if (semester !== null) {
      localStorage.setItem(SEMESTER_STORAGE_KEY, semester);
    } else {
      localStorage.removeItem(SEMESTER_STORAGE_KEY);
    }
  };

  const setSelectedComponentMeta = (code: string | null, name: string | null) => {
    setSelectedComponentCode(code);
    setSelectedComponentName(name);
  };

  return (
    <ComponentContext.Provider value={{
      selectedComponentId,
      setSelectedComponentId,
      selectedSemester,
      setSelectedSemester,
      selectedComponentCode,
      selectedComponentFullLabel,
      setSelectedComponentMeta,
    }}>
      {children}
    </ComponentContext.Provider>
  );
}

export function useComponentContext() {
  return useContext(ComponentContext);
}
