import { createContext, useContext, useState, ReactNode } from "react";

interface ComponentContextType {
  selectedComponentId: number | null;
  setSelectedComponentId: (id: number | null) => void;
  /** Short code, e.g. "TEC502" */
  selectedComponentCode: string | null;
  /** Full label, e.g. "TEC502 - Concorrência e Conectividade" */
  selectedComponentFullLabel: string | null;
  setSelectedComponentMeta: (code: string | null, name: string | null) => void;
}

const ComponentContext = createContext<ComponentContextType>({
  selectedComponentId: null,
  setSelectedComponentId: () => {},
  selectedComponentCode: null,
  selectedComponentFullLabel: null,
  setSelectedComponentMeta: () => {},
});

const COMPONENT_STORAGE_KEY = "selected-component-id";

export function ComponentProvider({ children }: { children: ReactNode }) {
  const [selectedComponentId, setSelectedComponentIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(COMPONENT_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
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

  const setSelectedComponentMeta = (code: string | null, name: string | null) => {
    setSelectedComponentCode(code);
    setSelectedComponentName(name);
  };

  return (
    <ComponentContext.Provider value={{
      selectedComponentId,
      setSelectedComponentId,
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
