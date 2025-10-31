/**
 * MobileNav — bottom navigation for small screens
 *
 * Summary:
 * - Shows Home/Create/Settings actions with a theme toggle.
 * - Highlights current tab based on the route.

 */

import { BottomNavigation, BottomNavigationAction, Paper, IconButton } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useLocation, useNavigate } from "react-router-dom";
import { useUI } from "../store/ui";

/* ---------------------------------------------
   [PRO] Purpose:
   Map pathname to a stable bottom-nav value for highlighting.

   Context:
   Makes current tab logic easier to extend (e.g., analytics, favorites).

   Edge cases:
   Defaults to "home" for unknown paths.

   Notes:
   Behavior matches the original conditional.
---------------------------------------------- */
function getNavValue(pathname) {
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname === "/") return "home";
  return "home";
}

/**
 * MobileNav component
 */
export default function MobileNav() {
  const { toggleTheme, theme, setCreateOpen } = useUI();
  const nav = useNavigate();
  const loc = useLocation();

  const value = getNavValue(loc.pathname);

  return (
    <Paper
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        pb: "env(safe-area-inset-bottom)",
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        display: { xs: "block", md: "none" },
        zIndex: 50,
      }}
      elevation={0}
    >
      <BottomNavigation showLabels value={value} sx={{ background: "var(--surface)", color: "var(--text)" }}>
        <BottomNavigationAction
          value="home"
          label="Home"
          icon={<HomeIcon />}
          onClick={() => nav("/")}
          sx={{ color: "var(--text)" }}
        />
        <BottomNavigationAction
          value="create"
          label="Create"
          icon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ color: "var(--text)" }}
        />
        <BottomNavigationAction
          value="settings"
          label="Settings"
          icon={<SettingsIcon />}
          onClick={() => nav("/settings")}
          sx={{ color: "var(--text)" }}
        />
        <IconButton
          onClick={toggleTheme}
          sx={{ ml: 1, color: "var(--text)" }}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </BottomNavigation>
    </Paper>
  );
}
