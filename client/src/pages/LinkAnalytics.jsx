/**
 * (CLIENT) Analytics.jsx
 * Short: Dashboard for link analytics (overview, breakdowns, exports, share).

 */

import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/axios';
import {
  ToggleButton, ToggleButtonGroup, Grid, FormControl, InputLabel, Select, MenuItem, Chip, Paper,
  Button, Snackbar, Alert, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

const PIE_COLORS = ['var(--chart-primary)', 'var(--chart-blue)', 'var(--chart-amber)', '#8b5cf6', '#f472b6', '#14b8a6', '#f97316', '#22c55e', '#eab308'];
const STORAGE_KEY = 'analytics:view:v3';
const TOAST_HIDE_MS = 2500;

/* ================================================================== */
/* CSV helpers                                                         */
/* ================================================================== */
/* ------------------------------------------------------------------ */
/* [PRO] Purpose: Safe CSV generation with double-quote escaping.
   Context: Used by multiple exports; keep simple and dependency-free.  */
/* ------------------------------------------------------------------ */
function toCSV(rows, headers) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = headers.map(h => esc(h.label)).join(',');
  const body = rows.map(r => headers.map(h => esc(h.value(r))).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================== */
/* 30d weekly bucketing                                                */
/* ================================================================== */
function groupToWeeks(dayRows) {
  const weekKey = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    const ww = String(weekNo).padStart(2, '0');
    return `${date.getUTCFullYear()}-W${ww}`;
  };
  const map = new Map();
  for (const r of dayRows || []) {
    if (!r?.day) continue;
    const key = weekKey(r.day);
    map.set(key, (map.get(key) || 0) + (r.clicks || 0));
  }
  return Array.from(map.entries())
    .map(([week, clicks]) => ({ week, clicks }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
function mergeWeekly(curWeeks, prevWeeks) {
  const map = new Map();
  (curWeeks || []).forEach(d => map.set(d.week, { week: d.week, clicks: d.clicks }));
  (prevWeeks || []).forEach(d => {
    const row = map.get(d.week) || { week: d.week, clicks: 0 };
    row.clicksPrev = d.clicks;
    map.set(d.week, row);
  });
  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
}

export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const shareToken = params.get('share');
  const readOnly = !!shareToken;

  const urlHasParams = Array.from(params.keys()).filter(k => k !== 'share').length > 0;
  const saved = !urlHasParams ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') : null;

  const initialRange = urlHasParams ? (params.get('range') || '7d') : (saved?.range || '7d');
  const initialCompare = urlHasParams ? (params.get('compare') === '1') : !!saved?.compare;
  const initialBreakdown = urlHasParams ? (params.get('breakdown') || 'none') : (saved?.breakdown || 'none');
  const initialFilters = urlHasParams
    ? {
      country: params.get('country') || '',
      device: params.get('device') || '',
      browser: params.get('browser') || '',
      source: params.get('source') || '',
      medium: params.get('medium') || '',
      campaign: params.get('campaign') || '',
    }
    : (saved?.filters || { country: '', device: '', browser: '', source: '', medium: '', campaign: '' });

  const [range, setRange] = useState(initialRange);
  const [compare, setCompare] = useState(initialCompare);
  const [breakdown, setBreakdown] = useState(initialBreakdown);
  const [filters, setFilters] = useState(initialFilters);

  const [data, setData] = useState({
    byDay: [], byDayPrev: [],
    referrers: [], countries: [], devices: [], browsers: [],
    topLinks: [],
    totals: { clicks: 0, links: 0 },
    totalsPrev: { clicks: 0 },
    cohorts: [],
    utmOptions: { sources: [], mediums: [], campaigns: [] },
    recent: [],
    annotations: [],
    breakdownSeries: [],
    breakdownKeys: [],
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, msg: '', sev: 'success' });

  // Saved views
  const [views, setViews] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Share dialog
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Annotations
  const [annoOpen, setAnnoOpen] = useState(false);
  const [anno, setAnno] = useState({ tsInput: '', label: '', color: '#ef4444' });

  // Feature flags (client still fetches them; we only use `share` to disable the Share button)
  const [feats, setFeats] = useState({ sheets: true, mail: true, share: true });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ range, compare, filters, breakdown }));
  }, [range, compare, filters, breakdown]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (shareToken) next.set('share', shareToken);
    next.set('range', range);
    if (compare) next.set('compare', '1');
    if (breakdown !== 'none') next.set('breakdown', breakdown);
    Object.entries(filters).forEach(([k, v]) => { if (v) next.set(k, v); });
    setParams(next, { replace: true });
  }, [range, compare, filters, breakdown, setParams, shareToken]);

  /* ------------------------------------------------------------------ */
  /* [PRO] Purpose: Load overview payload (and saved views if writable).
     Context: Shows a toast on network/API failure without breaking UI.  */
  /* ------------------------------------------------------------------ */
  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({
      range,
      tz: String(new Date().getTimezoneOffset() * -1),
      compare: compare ? '1' : '0',
      breakdown,
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.medium ? { medium: filters.medium } : {}),
      ...(filters.campaign ? { campaign: filters.campaign } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.device ? { device: filters.device } : {}),
      ...(filters.browser ? { browser: filters.browser } : {}),
    }).toString();

    try {
      const url = shareToken ? `/analytics/share/${encodeURIComponent(shareToken)}/overview?${qs}` : `/analytics/overview?${qs}`;
      const { data } = await api.get(url);
      setData(data);
      if (!readOnly) {
        const vres = await api.get('/analytics/views');
        setViews(vres.data || []);
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to load analytics.';
      setToast({ open: true, msg, sev: 'error' });
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [range, compare, breakdown, JSON.stringify(filters), shareToken]);

  // Feature flags (only use `share` to disable Share)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/analytics/config');
        setFeats(prev => ({
          sheets: prev.sheets,   // client-side toggle; server enforces
          mail: prev.mail,
          share: data?.share === false ? false : true,
        }));
      } catch { /* ignore */ }
    })();
  }, []);

  // Derived
  const pctChange = useMemo(() => {
    const a = data.totals?.clicks || 0;
    const b = data.totalsPrev?.clicks || 0;
    if (!compare || b === 0) return null;
    const delta = ((a - b) / Math.max(1, b)) * 100;
    return Math.round(delta * 10) / 10;
  }, [data, compare]);

  const FilterSelect = ({ label, value, onChange, items }) => (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <MenuItem value=""><em>All</em></MenuItem>
        {items.map((x) => <MenuItem key={x || '(none)'} value={x}>{x || '(none)'}</MenuItem>)}
      </Select>
    </FormControl>
  );

  // CSV exports
  function mergeSeries(cur, prev) {
    const map = new Map();
    (cur || []).forEach(d => map.set(d.day, { day: d.day, clicks: d.clicks }));
    (prev || []).forEach(d => {
      const row = map.get(d.day) || { day: d.day, clicks: 0 };
      row.clicksPrev = d.clicks;
      map.set(d.day, row);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }
  const exportByTime = () => {
    if (range === '30d') {
      const curW = groupToWeeks(data.byDay);
      const prevW = groupToWeeks(data.byDayPrev || []);
      const rows = compare ? mergeWeekly(curW, prevW) : curW;
      const headers = compare
        ? [
          { label: 'Week', value: r => r.week },
          { label: 'Clicks (Current)', value: r => r.clicks || 0 },
          { label: 'Clicks (Previous)', value: r => r.clicksPrev || 0 },
        ]
        : [
          { label: 'Week', value: r => r.week },
          { label: 'Clicks', value: r => r.clicks || 0 },
        ];
      downloadCSV(`time_${range}.csv`, toCSV(rows, headers));
      return;
    }
    const headers = compare
      ? [
        { label: (range === '24h' ? 'Hour' : 'Day'), value: r => r.day },
        { label: 'Clicks (Current)', value: r => r.clicks || 0 },
        { label: 'Clicks (Previous)', value: r => r.clicksPrev || 0 },
      ]
      : [
        { label: (range === '24h' ? 'Hour' : 'Day'), value: r => r.day },
        { label: 'Clicks', value: r => r.clicks || 0 },
      ];
    const rows = compare ? mergeSeries(data.byDay, data.byDayPrev) : data.byDay;
    downloadCSV(`time_${range}.csv`, toCSV(rows, headers));
  };
  const exportTable = (rows, filename, cols) => {
    const headers = cols.map(([label, key]) => ({ label, value: r => r[key] }));
    downloadCSV(filename, toCSV(rows, headers));
  };
  const exportRecent = () => {
    const cols = [
      ['Timestamp', 'ts'], ['Link Code', 'linkCode'], ['Domain', 'linkDomain'], ['Referer', 'referer'],
      ['Country', 'country'], ['Device', 'device'], ['Browser', 'browser'],
      ['UTM Source', 'utm_source'], ['UTM Medium', 'utm_medium'], ['UTM Campaign', 'utm_campaign'],
      ['TZ Offset', 'tzOffset'], ['UA', 'ua'], ['IP Hash', 'ipHash']
    ];
    exportTable(data.recent, `recent_${range}.csv`, cols);
  };

  // Actions
  const sendDigest = async () => {
    try {
      const { data: resp } = await api.post('/analytics/digest/send?period=7d');
      setToast({ open: true, msg: resp?.message || 'Weekly digest requested.', sev: 'success' });
    } catch (e) {
      const msg = e?.response?.data?.message || 'Digest failed or not configured.';
      setToast({ open: true, msg, sev: 'error' });
    }
  };

  const saveView = async () => {
    try {
      await api.post('/analytics/views', { name: saveName, range, compare, filters, breakdown });
      setSaveOpen(false); setSaveName('');
      const { data } = await api.get('/analytics/views');
      setViews(data || []);
      setToast({ open: true, msg: 'View saved', sev: 'success' });
    } catch {
      setToast({ open: true, msg: 'Failed to save view', sev: 'error' });
    }
  };

  const deleteView = async (id) => {
    try {
      await api.delete(`/analytics/views/${id}`);
      setViews(v => v.filter(x => x._id !== id));
      setToast({ open: true, msg: 'View deleted', sev: 'success' });
    } catch {
      setToast({ open: true, msg: 'Failed to delete view', sev: 'error' });
    }
  };

  const applyView = (v) => {
    setRange(v.range || '7d');
    setCompare(!!v.compare);
    setBreakdown(v.breakdown || 'none');
    setFilters(v.filters || { country: '', device: '', browser: '', source: '', medium: '', campaign: '' });
  };

  const createShare = async () => {
    try {
      const { data: resp } = await api.post('/analytics/share/create', { range, compare, filters, breakdown, expiresInDays: 14 });
      const url = resp.url;
      setShareUrl(url);

      if (navigator.share) {
        try {
          await navigator.share({ title: 'Analytics share', text: 'View my analytics:', url });
          setToast({ open: true, msg: 'Shared!', sev: 'success' });
          return;
        } catch (_) { /* user canceled */ }
      }
      setShareOpen(true);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Share not configured';
      setToast({ open: true, msg, sev: 'error' });
    }
  };

  const exportSheets = async () => {
    try {
      const { data: resp } = await api.post('/analytics/export/sheets', { range, compare, filters, breakdown });
      setToast({ open: true, msg: resp?.message || 'Pushed to Google Sheets', sev: 'success' });
    } catch (e) {
      const msg = e?.response?.data?.message || 'Sheets export failed';
      setToast({ open: true, msg, sev: 'error' });
    }
  };

  const addAnnotation = async () => {
    try {
      const tsISO = parseTs(anno.tsInput);
      if (!tsISO || !anno.label.trim()) {
        setToast({ open: true, msg: 'Please enter a valid date/time and label.', sev: 'warning' });
        return;
      }
      await api.post('/analytics/annotations', { ts: tsISO, label: anno.label.trim(), color: anno.color || '#ef4444' });
      setAnno({ tsInput: '', label: '', color: '#ef4444' });
      setAnnoOpen(false);
      await load();
      setToast({ open: true, msg: 'Annotation added', sev: 'success' });
    } catch {
      setToast({ open: true, msg: 'Failed to add annotation', sev: 'error' });
    }
  };
  const deleteAnnotation = async (id) => {
    try {
      await api.delete(`/analytics/annotations/${id}`);
      load();
    } catch { /* ignore */ }
  };

  // Chart series
  const timeSeries = useMemo(() => {
    if (range === '30d') {
      const curW = groupToWeeks(data.byDay);
      const prevW = groupToWeeks(data.byDayPrev || []);
      return compare ? mergeWeekly(curW, prevW) : curW;
    }
    return compare ? (function mergeSeries(cur, prev) {
      const map = new Map();
      (cur || []).forEach(d => map.set(d.day, { day: d.day, clicks: d.clicks }));
      (prev || []).forEach(d => {
        const row = map.get(d.day) || { day: d.day, clicks: 0 };
        row.clicksPrev = d.clicks;
        map.set(d.day, row);
      });
      return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
    })(data.byDay, data.byDayPrev) : data.byDay;
  }, [data.byDay, data.byDayPrev, range, compare]);

  const stackKeys = data.breakdownKeys?.length ? data.breakdownKeys : [];
  const hasBreakdown = breakdown !== 'none' && data.breakdownSeries?.length;

  return (
    <div className="min-h-screen">
      <Topbar />
      <div className="page p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Analytics {readOnly && <span className="text-sm text-muted">(shared view)</span>}</div>
            <div className="text-sm text-muted">Across all links</div>
          </div>

          {/* ===== MOBILE-FRIENDLY TOOLBAR ===== */}
          <div className="w-full md:w-auto">
            {!readOnly && (
              <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Compare switch */}
                <FormControlLabel
                  control={<Switch size="small" checked={compare} onChange={(e) => setCompare(e.target.checked)} />}
                  label="Compare"
                />

                {/* Range + Breakdown (stack on mobile) */}
                <div className="flex flex-col gap-2 w-full sm:flex-row">
                  {/* Range */}
                  <div className="w-full">
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={range}
                      onChange={(_, v) => v && setRange(v)}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        '& .MuiToggleButton-root': { flex: 1, minWidth: 0, px: 1 }
                      }}
                    >
                      <ToggleButton value="24h">24H</ToggleButton>
                      <ToggleButton value="7d">7D</ToggleButton>
                      <ToggleButton value="30d">30D</ToggleButton>
                    </ToggleButtonGroup>
                  </div>

                  {/* Breakdown (wraps on small screens) */}
                  <div className="w-full">
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={breakdown}
                      onChange={(_, v) => v && setBreakdown(v)}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        flexWrap: 'wrap',
                        '& .MuiToggleButton-root': {
                          flex: '1 1 33%',
                          minWidth: 0,
                          px: 1
                        },
                        rowGap: 0.5,
                        columnGap: 0.5
                      }}
                    >
                      <ToggleButton value="none">No Split</ToggleButton>
                      <ToggleButton value="device">Device</ToggleButton>
                      <ToggleButton value="browser">Browser</ToggleButton>
                      <ToggleButton value="country">Country</ToggleButton>
                    </ToggleButtonGroup>
                  </div>
                </div>

                {/* Actions → tidy 2×2 grid on phones */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                  <Button size="small" variant="outlined" onClick={sendDigest}>
                    Digest
                  </Button>

                  {/* NEW: Export to Google Sheets (button was previously empty) */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadOutlinedIcon />}
                    onClick={exportSheets}
                  >
                    Sheets
                  </Button>

                  <Button size="small" variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={() => setSaveOpen(true)}>
                    Save View
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ShareOutlinedIcon />}
                    onClick={createShare}
                    disabled={feats.share === false}
                    title={feats.share === false ? 'Set JWT_SECRET on server to enable' : ''}
                  >
                    Share
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Saved Views */}
        {!readOnly && (
          <Paper className="card p-3">
            {views.length ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm text-muted mr-2">Saved Views:</div>
                {views.map(v => (
                  <div key={v._id} className="flex items-center gap-1">
                    <Button size="small" variant="outlined" onClick={() => applyView(v)}>{v.name}</Button>
                    <IconButton size="small" onClick={() => deleteView(v._id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">No saved views yet.</div>
            )}
          </Paper>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Paper className="card p-5">
            <div className="text-sm text-muted">Total Clicks</div>
            <div className="mt-1 text-3xl font-semibold">{data.totals.clicks}</div>
            {compare && (
              <div className={`mt-1 text-xs ${pctChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange)}% vs previous
              </div>
            )}
          </Paper>
          <Paper className="card p-5"><div className="text-sm text-muted">Links</div><div className="mt-1 text-3xl font-semibold">{data.totals.links}</div></Paper>
          <Paper className="card p-5">
            <div className="text-sm text-muted">Top Referrers</div>
            <div className="mt-2 flex gap-1 flex-wrap">{data.referrers.slice(0, 4).map(r => <Chip key={r.ref} size="small" label={`${(r.ref || 'direct').toString().slice(0, 18)} (${r.count})`} />)}</div>
          </Paper>
          <Paper className="card p-5">
            <div className="text-sm text-muted">Top Countries</div>
            <div className="mt-2 flex gap-1 flex-wrap">{data.countries.slice(0, 4).map(c => <Chip key={c.country} size="small" label={`${c.country} (${c.count})`} />)}</div>
          </Paper>
        </div>

        {/* Filters */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}><FilterSelect label="Country" value={filters.country} onChange={(v) => setFilters(s => ({ ...s, country: v }))} items={data.countries.map(x => x.country)} /></Grid>
          <Grid item xs={6} sm={3} md={2}><FilterSelect label="Device" value={filters.device} onChange={(v) => setFilters(s => ({ ...s, device: v }))} items={data.devices.map(x => x.device)} /></Grid>
          <Grid item xs={6} sm={3} md={2}><FilterSelect label="Browser" value={filters.browser} onChange={(v) => setFilters(s => ({ ...s, browser: v }))} items={data.browsers.map(x => x.browser)} /></Grid>
          <Grid item xs={12} sm={6} md={2}><FilterSelect label="UTM Source" value={filters.source} onChange={(v) => setFilters(s => ({ ...s, source: v }))} items={data.utmOptions.sources} /></Grid>
          <Grid item xs={12} sm={6} md={2}><FilterSelect label="UTM Medium" value={filters.medium} onChange={(v) => setFilters(s => ({ ...s, medium: v }))} items={data.utmOptions.mediums} /></Grid>
          <Grid item xs={12} sm={6} md={2}><FilterSelect label="UTM Campaign" value={filters.campaign} onChange={(v) => setFilters(s => ({ ...s, campaign: v }))} items={data.utmOptions.campaigns} /></Grid>
        </Grid>

        {/* Time chart */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">
            {breakdown === 'none'
              ? (range === '24h'
                ? 'Hourly Clicks (Last 24h)'
                : range === '7d'
                  ? 'Daily Clicks (Last 7 days)'
                  : 'Weekly Clicks (Last 30 days)')
              : `Time by ${breakdown.charAt(0).toUpperCase() + breakdown.slice(1)}`}
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" variant="outlined" onClick={exportByTime}>Export CSV</Button>
            {!readOnly && <Button size="small" variant="outlined" onClick={() => setAnnoOpen(true)}>Add Annotation</Button>}
          </div>
        </div>

        <div className="card p-4">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {hasBreakdown ? (
                <BarChart data={data.breakdownSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  {stackKeys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </BarChart>
              ) : (
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={range === '30d' ? 'week' : 'day'} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="clicks" name="Current" stroke="var(--chart-primary)" strokeWidth={2} dot={false} />
                  {compare && <Line type="monotone" dataKey="clicksPrev" name="Previous" stroke="var(--chart-blue)" strokeWidth={2} dot={false} />}
                  {range !== '30d' && data.annotations.map((a) => (
                    <ReferenceLine key={a._id} x={formatX(a.ts, range)} stroke={a.color || '#ef4444'} strokeDasharray="3 3" label={{ value: a.label, position: 'top', fontSize: 10 }} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cohorts by UTM Campaign */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Cohorts: UTM Campaign</div>
          <Button size="small" variant="outlined" onClick={() => exportTable(data.cohorts, 'cohorts_campaign.csv', [['Campaign', 'campaign'], ['Clicks', 'clicks']])}>Export CSV</Button>
        </div>
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr><th className="px-3 py-2">Campaign</th><th className="px-3 py-2">Clicks</th></tr>
              </thead>
              <tbody>
                {data.cohorts.map((c) => (<tr key={c.campaign} className="border-t table-row"><td className="px-3 py-2">{c.campaign}</td><td className="px-3 py-2">{c.clicks}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top links */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Top Links</div>
          <Button size="small" variant="outlined" onClick={() => exportTable(data.topLinks, 'top_links.csv', [['Code', 'code'], ['Domain', 'domain'], ['Short URL', 'shortUrl'], ['Clicks', 'clicks']])}>Export CSV</Button>
        </div>
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Domain</th><th className="px-3 py-2">Short</th><th className="px-3 py-2">Clicks</th></tr>
              </thead>
              <tbody>
                {data.topLinks.map((t) => (
                  <tr key={t._id} className="border-t table-row">
                    <td className="px-3 py-2">{t.code}</td>
                    <td className="px-3 py-2">{t.domain || '-'}</td>
                    <td className="px-3 py-2">
                      {t.shortUrl ? <a className="text-[color:var(--primary)] hover:underline" href={t.shortUrl} target="_blank" rel="noreferrer">{t.shortUrl}</a> : <em className="text-muted">—</em>}
                    </td>
                    <td className="px-3 py-2">{t.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Clicks */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Recent Clicks</div>
          <Button size="small" variant="outlined" onClick={exportRecent}>Export CSV</Button>
        </div>
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Link</th>
                  <th className="px-3 py-2">Referer</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Browser</th>
                  <th className="px-3 py-2">UTM</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((c, i) => (
                  <tr key={i} className="border-t table-row">
                    <td className="px-3 py-2">{new Date(c.ts).toLocaleString()}</td>
                    <td className="px-3 py-2">{c.linkDomain ? `${c.linkDomain}/r/${c.linkCode}` : c.linkCode || '-'}</td>
                    <td className="px-3 py-2">{c.referer}</td>
                    <td className="px-3 py-2">{c.country || '-'}</td>
                    <td className="px-3 py-2">{c.device}</td>
                    <td className="px-3 py-2">{c.browser}</td>
                    <td className="px-3 py-2">
                      {(c.utm_source || c.utm_medium || c.utm_campaign)
                        ? `src:${c.utm_source || '-'} • med:${c.utm_medium || '-'} • camp:${c.utm_campaign || '-'}`
                        : <em className="text-muted">—</em>}
                    </td>
                  </tr>
                ))}
                {!data.recent.length && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">No recent clicks.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <MobileNav />

      {/* Save View Dialog */}
      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Save View</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveView} disabled={!saveName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Add Annotation Dialog */}
      <Dialog open={annoOpen} onClose={() => setAnnoOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Annotation</DialogTitle>
        <DialogContent className="space-y-3">
          <TextField
            fullWidth
            label={range === '24h' ? 'Timestamp (YYYY-MM-DD HH:00 local)' : 'Date (YYYY-MM-DD)'}
            placeholder={range === '24h' ? '2025-10-23 14:00' : '2025-10-23'}
            value={anno.tsInput}
            onChange={(e) => setAnno(s => ({ ...s, tsInput: e.target.value }))}
            helperText="Enter hour or date; it will be converted to ISO when you click Add."
          />
          <TextField fullWidth label="Label" value={anno.label} onChange={(e) => setAnno(s => ({ ...s, label: e.target.value }))} />
          <TextField fullWidth label="Color (hex)" value={anno.color} onChange={(e) => setAnno(s => ({ ...s, color: e.target.value }))} />
          <div className="text-xs text-muted">Tip: Use #10b981 (green), #3b82f6 (blue), #ef4444 (red).</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnnoOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addAnnotation} disabled={!anno.tsInput || !anno.label.trim()}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Share</DialogTitle>
        <DialogContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outlined" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`, '_blank')}>WhatsApp</Button>
            <Button variant="outlined" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}>Facebook</Button>
            <Button variant="outlined" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('View my analytics')}`, '_blank')}>X/Twitter</Button>
            <Button variant="outlined" onClick={() => window.open(`mailto:?subject=${encodeURIComponent('Analytics share')}&body=${encodeURIComponent(shareUrl)}`, '_self')}>Email</Button>
          </div>
          <div className="mt-2 text-sm break-all p-2 rounded bg-gray-100">{shareUrl}</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => {
            try { await navigator.clipboard.writeText(shareUrl); setToast({ open: true, msg: 'Link copied', sev: 'success' }); } catch { /* ignore */ }
          }}>Copy link</Button>
          <Button variant="contained" onClick={() => setShareOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        onClose={() => setToast(s => ({ ...s, open: false }))}
        autoHideDuration={TOAST_HIDE_MS}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.sev} sx={{ width: '100%' }}>{toast.msg}</Alert>
      </Snackbar>
    </div>
  );
}

/* ------------------------------ tiny helpers ------------------------------ */
function formatX(ts, range) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  if (range === '24h') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseTs(input) {
  const s = String(input).trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):?(\d{2})?)?$/);
  if (!m) return '';
  const [_, y, mo, d, hh, mm] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh || '0'), Number(mm || '0'), 0, 0);
  return date.toISOString();
}
