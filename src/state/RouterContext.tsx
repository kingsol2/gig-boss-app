import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface RouterValue {
  path: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigate = useCallback((nextPath: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState({}, "", nextPath);
    else window.history.pushState({}, "", nextPath);
    setPath(new URL(nextPath, window.location.origin).pathname);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const value = useMemo(
    () => ({ path, navigate, back: () => window.history.back() }),
    [navigate, path],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const context = useContext(RouterContext);
  if (!context) throw new Error("useRouter must be used inside RouterProvider");
  return context;
}
