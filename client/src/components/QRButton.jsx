/**
 * QRButton — small menu to download QR codes for a link
 *
 * Summary:
 * - Opens a menu and lets user download PNG/SVG QR files.

 */

import { Menu, MenuItem, IconButton } from "@mui/material";
import QrCodeIcon from "@mui/icons-material/QrCode2";
import { useState } from "react";
import { api } from "../api/axios";

/**
 * @param {{ linkId: string }} props
 */
export default function QRButton({ linkId }) {
  const [anchor, setAnchor] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const open = Boolean(anchor);

  /* ---------------------------------------------
     [PRO] Purpose:
     Download QR as blob with safe URL lifecycle.

     Context:
     Avoids stale object URLs and double-click issues.

     Edge cases:
     Network failures or blocked popups; menu closes either way.

     Notes:
     File named deterministically by id + format.
  ---------------------------------------------- */
  const download = async (format) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await api.get(`/links/${linkId}/qr?format=${format}&size=640`, { responseType: "blob" });
      const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data || ""], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${linkId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Give the browser a tick to start the download before revoke
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setAnchor(null);
      setDownloading(false);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Open QR download menu"
        disabled={downloading}
      >
        <QrCodeIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={open} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => download("png")} disabled={downloading}>
          Download PNG
        </MenuItem>
        <MenuItem onClick={() => download("svg")} disabled={downloading}>
          Download SVG
        </MenuItem>
      </Menu>
    </>
  );
}
