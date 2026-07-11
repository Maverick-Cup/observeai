import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BadAnswers from "./pages/BadAnswers";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import Cost from "./pages/Cost";
import Alerts from "./pages/Alerts";
import Feedback from "./pages/Feedback";
import DLQ from "./pages/DLQ";
import Settings from "./pages/Settings";
import StressTest from "./pages/StressTest";
import Reliability from "./pages/Reliability";
import Guardrails from "./pages/Guardrails";
import Reports from "./pages/Reports";
import Evals from "./pages/Evals";
import ContextMonitor from "./pages/ContextMonitor";
import SchemaRegistry from "./pages/SchemaRegistry";
import Ingestion from "./pages/Ingestion";
import IntegrationsPage from "./pages/Integrations";

/** Wraps a page component inside the authenticated AppShell. */
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/bad-answers" element={<ProtectedPage><BadAnswers /></ProtectedPage>} />
            <Route path="/traces" element={<ProtectedPage><Traces /></ProtectedPage>} />
            <Route path="/traces/:traceId" element={<ProtectedPage><TraceDetail /></ProtectedPage>} />
            <Route path="/cost" element={<ProtectedPage><Cost /></ProtectedPage>} />
            <Route path="/alerts" element={<ProtectedPage><Alerts /></ProtectedPage>} />
            <Route path="/feedback" element={<ProtectedPage><Feedback /></ProtectedPage>} />
            <Route path="/dlq" element={<ProtectedPage><DLQ /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
            <Route path="/guardrails" element={<ProtectedPage><Guardrails /></ProtectedPage>} />
            <Route path="/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
            <Route path="/stress-test" element={<ProtectedPage><StressTest /></ProtectedPage>} />
            <Route path="/reliability" element={<ProtectedPage><Reliability /></ProtectedPage>} />
            <Route path="/evals" element={<ProtectedPage><Evals /></ProtectedPage>} />
            <Route path="/context" element={<ProtectedPage><ContextMonitor /></ProtectedPage>} />
            <Route path="/schema" element={<ProtectedPage><SchemaRegistry /></ProtectedPage>} />
            <Route path="/ingestion" element={<ProtectedPage><Ingestion /></ProtectedPage>} />
            <Route path="/integrations" element={<ProtectedPage><IntegrationsPage /></ProtectedPage>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}