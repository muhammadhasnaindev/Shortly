/**
 * Topbar — app header with brand, quick nav, search, create, theme, settings, logout
 *
 * Summary:
 * - Sticky header using MUI AppBar/Toolbar and your token variables.
 * - Provides quick actions and a search input bound to UI store.
 */

import { AppBar, Toolbar, IconButton, Typography, InputBase, Button, Tooltip, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import HomeIcon from "@mui/icons-material/Home";
import { useUI } from "../store/ui";
import { useAuth } from "../store/auth";
import { useNavigate, Link } from "react-router-dom";

/**
 * Topbar component
 */
export default function Topbar() {
  const { setCreateOpen, searchRaw, setSearchRaw, theme, toggleTheme } = useUI();
  const { logout } = useAuth();
  const nav = useNavigate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        background: "var(--surface)",
        color: "var(--text)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{ fontWeight: 800, letterSpacing: 0.4, textDecoration: "none", color: "inherit" }}
          >
            Shortly
          </Typography>

          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, ml: 1 }}>
            <Button
              size="small"
              startIcon={<HomeIcon fontSize="small" />}
              onClick={() => nav("/")}
              sx={{ color: "var(--text)" }}
            >
              Home
            </Button>
            <Button
              size="small"
              startIcon={<SettingsIcon fontSize="small" />}
              onClick={() => nav("/settings")}
              sx={{ color: "var(--text)" }}
            >
              Settings
            </Button>
          </Box>

          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <IconButton onClick={() => nav("/")} sx={{ color: "var(--text)" }} aria-label="Go to home">
              <HomeIcon />
            </IconButton>
          </Box>
        </Box>

        <div className="flex-1 min-w-[220px] max-w-xl ml-2">
          <div className="flex items-center gap-2 input-surface">
            <SearchIcon fontSize="small" />
            <InputBase
              placeholder="Search links…"
              fullWidth
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              autoComplete="off"
              sx={{ color: "var(--text)" }}
              inputProps={{ "aria-label": "Search links" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="contained"
            onClick={() => setCreateOpen(true)}
            sx={{ background: "var(--primary)", "&:hover": { background: "var(--primary-hover)" } }}
            startIcon={<AddIcon />}
          >
            Create Link
          </Button>

          <Tooltip title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              sx={{ color: "var(--text)", display: { xs: "none", md: "inline-flex" } }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              onClick={() => nav("/settings")}
              sx={{ color: "var(--text)" }}
              aria-label="Open settings"
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={logout} sx={{ color: "var(--text)" }} aria-label="Log out">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </div>
      </Toolbar>
    </AppBar>
  );
}
