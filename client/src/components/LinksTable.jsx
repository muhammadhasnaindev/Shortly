/**
 * LinksTable — responsive list of short links with actions
 *
 * Summary:
 * - Desktop table + mobile cards layout, with copy/open/analytics/QR/edit/delete actions.
 * - Uses MUI icons/buttons and react-router navigation.

 */

import { IconButton, Chip, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import BarChartIcon from "@mui/icons-material/InsertChartOutlined";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import QRButton from "./QRButton";

/**
 * LinksTable component
 * @param {{ items: any[], onDelete: (row:any)=>void, onEdit: (row:any)=>void }} props
 */
export default function LinksTable({ items, onDelete, onEdit }) {
  const nav = useNavigate();
  const copy = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="w-full">
      {/* Desktop/Table */}
      <div className="hidden md:block card p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="table-head">
            <tr className="text-left">
              <th className="px-4 py-3">Short</th>
              <th className="px-4 py-3">Original</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Clicks</th>
              <th className="px-2 py-3 text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row._id}
                className="table-row border-t hover:bg-[color:var(--primary-light)]/30"
              >
                <td className="px-4 py-3 flex items-center gap-2">
                  <a
                    className="text-[color:var(--primary)] hover:underline break-all"
                    href={row.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.shortUrl}
                  </a>
                  <Tooltip title="Copy short URL">
                    <IconButton
                      size="small"
                      onClick={() => copy(row.shortUrl)}
                      aria-label="Copy short URL"
                    >
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </td>
                <td className="px-4 py-3 max-w-[520px]">
                  <div className="truncate" title={row.longUrl}>
                    {row.longUrl}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {dayjs(row.createdAt).format("YYYY-MM-DD")}
                </td>
                <td className="px-4 py-3">
                  {row.isActive ? (
                    <Chip size="small" label="Active" color="success" />
                  ) : (
                    <Chip size="small" label="Disabled" color="default" />
                  )}
                </td>
                <td className="px-4 py-3">{row.clicksCount}</td>
                <td className="px-2 py-2 text-right pr-3 whitespace-nowrap">
                  <Tooltip title="Open">
                    <IconButton
                      size="small"
                      href={row.shortUrl}
                      target="_blank"
                      aria-label="Open short URL"
                    >
                      <OpenInNewIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Analytics">
                    <IconButton
                      size="small"
                      onClick={() => nav(`/links/${row._id}`)}
                      aria-label="Open analytics"
                    >
                      <BarChartIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>

                  <QRButton linkId={row._id} />

                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(row)}
                      aria-label="Edit link"
                    >
                      <EditIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onDelete(row)}
                      aria-label="Delete link"
                    >
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Cards */}
      <div className="md:hidden grid gap-3">
        {items.map((row) => (
          <div key={row._id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <a
                className="text-[color:var(--primary)] font-medium break-all leading-snug"
                href={row.shortUrl}
                target="_blank"
                rel="noreferrer"
              >
                {row.shortUrl}
              </a>
              <div className="flex items-center gap-1 flex-shrink-0">
                <IconButton
                  size="small"
                  onClick={() => copy(row.shortUrl)}
                  aria-label="Copy short URL"
                >
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  size="small"
                  href={row.shortUrl}
                  target="_blank"
                  aria-label="Open short URL"
                >
                  <OpenInNewIcon fontSize="inherit" />
                </IconButton>
              </div>
            </div>

            <div className="text-sm text-muted mt-1 line-clamp-2 break-all">
              {row.longUrl}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-6 text-sm">
              <Chip
                size="small"
                label={row.isActive ? "Active" : "Disabled"}
                color={row.isActive ? "success" : "default"}
              />
              <span>{dayjs(row.createdAt).format("YYYY-MM-DD")}</span>
              <span className="font-medium">{row.clicksCount} clicks</span>
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <IconButton
                size="small"
                onClick={() => nav(`/links/${row._id}`)}
                aria-label="Open analytics"
              >
                <BarChartIcon fontSize="inherit" />
              </IconButton>

              <QRButton linkId={row._id} />

              <IconButton
                size="small"
                onClick={() => onEdit(row)}
                aria-label="Edit link"
              >
                <EditIcon fontSize="inherit" />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => onDelete(row)}
                aria-label="Delete link"
              >
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
