import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ClassProvider } from "./contexts/ClassContext";
import Home from "./pages/Home";
import ClassesPage from "./pages/ClassesPage";
import StudentsPage from "./pages/StudentsPage";
import SessionsPage from "./pages/SessionsPage";
import EvaluatePage from "./pages/EvaluatePage";
import ResultsPage from "./pages/ResultsPage";
import TutorialEvalPage from "./pages/TutorialEvalPage";
import StudentResults from "./pages/StudentResults";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/classes"} component={ClassesPage} />
      <Route path={"/students"} component={StudentsPage} />
      <Route path={"/sessions"} component={SessionsPage} />
      <Route path={"/evaluate/:sessionId"} component={EvaluatePage} />
      <Route path={"/tutorial-eval"} component={TutorialEvalPage} />
      <Route path={"/results"} component={ResultsPage} />
      <Route path={"/my-results"} component={StudentResults} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <ClassProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ClassProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
