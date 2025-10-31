/**
 * Dashboard — overview metrics, links table, and quick edit dialog
 *
 * Summary:
 * - Fetches and displays paginated links filtered by global search.
 * - Provides inline delete and a modal to edit selected link fields.

 */

import Topbar from "../components/Topbar";
import MobileNav from "../components/MobileNav";
import StatCard from "../components/StatCard";
import LinksTable from "../components/LinksTable";
import { useUI } from "../store/ui";
import { api } from "../api/axios";
import { useEffect, useState } from "react";
import { TableSkeleton } from "../components/Skeletons";
import {
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  MenuItem,
  Select,
  FormControlLabel,
  Switch,
  Box,
} from "@mui/material";
import PasswordInput from "../components/PasswordInput";

/* ---------------------------------------------
   Constants (no magic numbers)
---------------------------------------------- */
const DEFAULT_PAGE = 1;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const MSG = {
  DELETE_CONFIRM: "Delete this link?",
  SAVE_FAILED: "Save failed",
};

/* ---------------------------------------------
   [PRO] Purpose:
   Small helpers to keep render clean and intent obvious.

   Context:
   Sums are scoped to currently loaded items by design.

   Edge cases:
   Missing fields default to 0.

   Notes:
   No behavioral change vs original.
---------------------------------------------- */
const sumField = (items, key, sliceN = 5) =>
  items.slice(0, sliceN).reduce((a, b) => a + (Number(b?.[key]) || 0), 0);

export default function Dashboard() {
  const { search, setCreateOpen, linksVersion } = useUI();

  const [list, setList] = useState({ items: [], total: 0, page: DEFAULT_PAGE, size: 10 });
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [err, setErr] = useState("");
  const [filterSize, setFilterSize] = useState(10);

  /* ---------------------------------------------
     [PRO] Purpose:
     Fetch paginated links with current filters.

     Context:
     Same endpoint/params; wraps state updates with loading flags.

     Edge cases:
     Ensures loading false on finally; search safely encoded.

     Notes:
     Called on search/size/version changes.
  ---------------------------------------------- */
  const load = async (page = DEFAULT_PAGE, size = filterSize) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/links?search=${encodeURIComponent(search)}&page=${page}&size=${size}`
      );
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterSize, linksVersion]);

  const onDelete = async (row) => {
    if (!window.confirm(MSG.DELETE_CONFIRM)) return;
    await api.delete(`/links/${row._id}`);
    load(list.page);
  };

  const onEdit = (row) => {
    setEditRow({
      ...row,
      _newPassword: "",
      _clearPassword: false,
      domain: row.domain || "",
      maxClicks: typeof row.maxClicks === "number" ? row.maxClicks : 0,
    });
  };

  /* ---------------------------------------------
     [PRO] Purpose:
     Patch selected fields of the link and update local list.

     Context:
     Mirrors create/edit modal shape; keeps server contract stable.

     Edge cases:
     - Empty/invalid maxClicks handled.
     - Domain normalized to lower-case host or ''.
     - Optional password clear vs new password.

     Notes:
     Keeps dialog and list in sync without reload.
  ---------------------------------------------- */
  const saveEdit = async () => {
    setErr("");
    try {
      const parsedMax = Number.isFinite(+editRow.maxClicks)
        ? parseInt(editRow.maxClicks, 10)
        : undefined;

      const payload = {
        longUrl: editRow.longUrl,
        notes: editRow.meta?.notes || "",
        isActive: !!editRow.isActive,
        expiresAt: editRow.expiresAt || null,
        domain: (editRow.domain || "").trim().toLowerCase(),
        maxClicks: parsedMax,
      };

      if (editRow._clearPassword) {
        payload.password = "";
      } else if (editRow._newPassword && editRow._newPassword.length >= 4) {
        payload.password = editRow._newPassword;
      }

      const { data } = await api.patch(`/links/${editRow._id}`, payload);
      setEditRow(null);
      const newItems = list.items.map((it) => (it._id === data._id ? data : it));
      setList({ ...list, items: newItems });
    } catch (e) {
      setErr(e?.response?.data?.message || MSG.SAVE_FAILED);
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="page p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Today Clicks" value={sumField(list.items, "todayClicks", 5)} />
          <StatCard title="7d Clicks" value={sumField(list.items, "weekClicks", 5)} />
          <StatCard title="Active Links" value={list.items.filter((i) => i.isActive).length} />
          <StatCard title="Disabled" value={list.items.filter((i) => !i.isActive).length} />
        </section>

        <section className="flex items-center justify-between">
          <div className="text-lg font-semibold">My Links</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Rows:</span>
            <Select
              size="small"
              value={filterSize}
              onChange={(e) => setFilterSize(e.target.value)}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
            <button
              className="btn-primary"
              onClick={() => setCreateOpen(true)}
              aria-label="Create new short link"
            >
              + Create Link
            </button>
          </div>
        </section>

        {loading ? (
          <TableSkeleton />
        ) : (
          <LinksTable items={list.items} onDelete={onDelete} onEdit={onEdit} />
        )}

        <Dialog open={!!editRow} onClose={() => setEditRow(null)} fullWidth maxWidth="sm">
          <DialogTitle>Edit Link</DialogTitle>
          <DialogContent dividers sx={{ display: "grid", gap: 2, pt: 2 }}>
            {err && <Alert severity="error">{err}</Alert>}

            <TextField
              label="Original URL"
              value={editRow?.longUrl || ""}
              onChange={(e) => setEditRow({ ...editRow, longUrl: e.target.value })}
            />
            <TextField
              label="Notes"
              value={editRow?.meta?.notes || ""}
              onChange={(e) =>
                setEditRow({ ...editRow, meta: { ...(editRow?.meta || {}), notes: e.target.value } })
              }
            />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Custom Domain (host only)"
                placeholder="go.example.com"
                value={editRow?.domain || ""}
                onChange={(e) => setEditRow({ ...editRow, domain: e.target.value.trim() })}
              />
              <TextField
                label="Max Clicks (0 = unlimited)"
                type="number"
                inputProps={{ min: 0 }}
                value={editRow?.maxClicks ?? 0}
                onChange={(e) => setEditRow({ ...editRow, maxClicks: e.target.value })}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={!!editRow?.isActive}
                  onChange={(e) => setEditRow({ ...editRow, isActive: e.target.checked })}
                />
              }
              label="Active"
            />

            <div className="grid gap-2">
              <PasswordInput
                label="Set/Change Password (optional)"
                name="_newPassword"
                value={editRow?._newPassword || ""}
                onChange={(e) => setEditRow({ ...editRow, _newPassword: e.target.value })}
                placeholder="At least 4 characters"
                helperText="Leave blank to keep existing password unchanged."
                autoComplete="new-password"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!editRow?._clearPassword}
                    onChange={(e) =>
                      setEditRow({
                        ...editRow,
                        _clearPassword: e.target.checked,
                        _newPassword: e.target.checked ? "" : editRow._newPassword,
                      })
                    }
                  />
                }
                label="Clear existing password"
              />
            </div>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Status"
                value={editRow?.isActive ? "Active" : "Disabled"}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Created"
                value={new Date(editRow?.createdAt || "").toLocaleString()}
                InputProps={{ readOnly: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditRow(null)}>Cancel</Button>
            <Button variant="contained" onClick={saveEdit}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </main>

      <MobileNav />
    </div>
  );
}
