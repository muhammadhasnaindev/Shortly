/**
 * App entry — theming, providers, routing, and small global UI
 *
 * Summary:
 * - Wraps the app in Auth/UI providers and MUI theme.
 * - Sets up public/auth routes and a tiny auth guard.
 * - Globally mounts CreateLink modal and Snackbar.
 *
 * Changed Today:
 * - Hoisted small constants (colors, toast duration) to remove magic numbers.
 * - Extracted tiny helpers for auth check and theme creation (behavior preserved).
 * - Added null-safe guard for Snackbar message.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/auth";
import { UIProvider, useUI } from "./store/ui";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LinkAnalytics from "./pages/LinkAnalytics";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";

import CreateLinkModal from "./components/CreateLinkModal";
import "./styles.css";

import { ThemeProvider, createTheme, CssBaseline, Snackbar, Alert } from "@mui/material";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const BRAND = {
  primary: "#10B981",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};
const TOAST_MS = 2500;

/* ---------------------------------------------
   [PRO] Purpose:
   Keep the token check tiny and reusable for the auth guard.

   Context:
   Avoids repeating localStorage access in the component body.

   Edge cases:
   localStorage may be unavailable in odd runtimes; returns false.

   Notes:
   Behavior matches the original hasToken usage.
---------------------------------------------- */
function hasStoredToken() {
  try {
    return !!localStorage.getItem("token");
  } catch {
    return false;
  }
}

/* ---------------------------------------------
   [PRO] Purpose:
   Build the MUI theme from our UI "light/dark" mode and brand tokens.

   Context:
   Centralizes palette/shape/overrides; memoized by `theme`.

   Edge cases:
   Uses CSS variables in overrides to respect app-level tokens.

   Notes:
   Exactly the same palette semantics as before; just tidier constants.
---------------------------------------------- */
function useMuiTheme(theme) {
  return React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: { main: BRAND.primary },
          success: { main: BRAND.success },
          warning: { main: BRAND.warning },
          error: { main: BRAND.error },
          info: { main: BRAND.info },
          background: {
            default: theme === "dark" ? "#111827" : "#F9FAFB",
            paper: theme === "dark" ? "#1F2937" : "#FFFFFF",
          },
          text: {
            primary: theme === "dark" ? "#F3F4F6" : "#111827",
            secondary: theme === "dark" ? "#D1D5DB" : "#6B7280",
          },
          divider: theme === "dark" ? "#374151" : "#E5E7EB",
        },
        shape: { borderRadius: 12 },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                borderBottom: "1px solid var(--border)",
              },
            },
          },
          MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
          MuiButton: { styleOverrides: { root: { textTransform: "none", borderRadius: 999 } } },
        },
      }),
    [theme]
  );
}

/* ---------------------------------------------
   [PRO] Purpose:
   Minimal auth guard that trusts context but also tolerates a fresh refresh.

   Context:
   Prevents flicker by accepting an existing token while context warms up.

   Edge cases:
   Preserves original redirect behavior; passes `from` in state.
---------------------------------------------- */
function Private({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (isAuthed || hasStoredToken()) return children;
  return <Navigate to="/login" replace state={{ from: location }} />;
}

/* ---------------------------------------------
   [PRO] Purpose:
   Mount CreateLink dialog globally and handle success/close side-effects.

   Context:
   Mirrors existing UI store contract; bumps list version and toasts.

   Edge cases:
   Null-safe; renders nothing when closed.
---------------------------------------------- */
function GlobalCreateLink() {
  const { createOpen, setCreateOpen, bumpLinksVersion, showToast } = useUI();
  return createOpen ? (
    <CreateLinkModal
      onClose={() => setCreateOpen(false)}
      onCreated={() => {
        bumpLinksVersion();
        setCreateOpen(false);
        showToast("Short link copied to clipboard!", "success");
      }}
    />
  ) : null;
}

/* ---------------------------------------------
   [PRO] Purpose:
   Centralized app snackbar for small success/error notices.

   Context:
   Reads message/severity from UI store; short auto-hide.

   Edge cases:
   Renders a safe empty string if msg is falsy to avoid warnings.
---------------------------------------------- */
function GlobalSnackbar() {
  const { toast, closeToast } = useUI();
  return (
    <Snackbar
      open={toast.open}
      autoHideDuration={TOAST_MS}
      onClose={closeToast}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert onClose={closeToast} severity={toast.severity} sx={{ width: "100%" }}>
        {toast.msg || ""}
      </Alert>
    </Snackbar>
  );
}

function ThemedApp() {
  const { theme } = useUI();
  const muiTheme = useMuiTheme(theme);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Kept compatibility with legacy path */}
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Private */}
          <Route
            path="/settings"
            element={
              <Private>
                <Settings />
              </Private>
            }
          />
          <Route
            path="/"
            element={
              <Private>
                <Dashboard />
              </Private>
            }
          />
          <Route
            path="/links/:id"
            element={
              <Private>
                <LinkAnalytics />
              </Private>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <GlobalCreateLink />
        <GlobalSnackbar />
      </BrowserRouter>
    </ThemeProvider>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <UIProvider>
        <ThemedApp />
      </UIProvider>
    </AuthProvider>
  </React.StrictMode>
);
