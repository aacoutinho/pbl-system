import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ClassContextType {
  selectedClassId: number | null;
  setSelectedClassId: (id: number | null) => void;
}

const ClassContext = createContext<ClassContextType>({
  selectedClassId: null,
  setSelectedClassId: () => {},
});

const STORAGE_KEY = "selected-class-id";

export function ClassProvider({ children }: { children: ReactNode }) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (selectedClassId !== null) {
      localStorage.setItem(STORAGE_KEY, String(selectedClassId));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedClassId]);

  return (
    <ClassContext.Provider value={{ selectedClassId, setSelectedClassId }}>
      {children}
    </ClassContext.Provider>
  );
}

export function useClassContext() {
  return useContext(ClassContext);
}
