import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ComponentContextType {
  selectedComponentId: number | null;
  setSelectedComponentId: (id: number | null) => void;
  selectedSemester: string | null;
  setSelectedSemester: (semester: string | null) => void;
}

const ComponentContext = createContext<ComponentContextType>({
  selectedComponentId: null,
  setSelectedComponentId: () => {},
  selectedSemester: null,
  setSelectedSemester: () => {},
});

const COMPONENT_STORAGE_KEY = "selected-component-id";
const SEMESTER_STORAGE_KEY = "selected-semester";

export function ComponentProvider({ children }: { children: ReactNode }) {
  const [selectedComponentId, setSelectedComponentIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(COMPONENT_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  const [selectedSemester, setSelectedSemesterState] = useState<string | null>(() => {
    return localStorage.getItem(SEMESTER_STORAGE_KEY) ?? null;
  });

  const setSelectedComponentId = (id: number | null) => {
    setSelectedComponentIdState(id);
    if (id !== null) {
      localStorage.setItem(COMPONENT_STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(COMPONENT_STORAGE_KEY);
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

  return (
    <ComponentContext.Provider value={{ selectedComponentId, setSelectedComponentId, selectedSemester, setSelectedSemester }}>
      {children}
    </ComponentContext.Provider>
  );
}

export function useComponentContext() {
  return useContext(ComponentContext);
}
