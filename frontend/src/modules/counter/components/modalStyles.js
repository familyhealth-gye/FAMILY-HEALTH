/**
 * modalStyles.js
 * Estilos inline compartidos por los subcomponentes del modal de cita.
 * Centralizado para consistencia visual.
 */

export const S = {
  inp: {
    width: "100%", padding: "8px 10px", border: "1.5px solid #BFDBFE",
    borderRadius: "8px", fontSize: "13px", boxSizing: "border-box",
    outline: "none", background: "white",
  },
  inpSm: {
    width: "100%", padding: "6px 10px", border: "1.5px solid #BFDBFE",
    borderRadius: "7px", fontSize: "12px", boxSizing: "border-box",
    outline: "none", background: "white",
  },
  lbl: {
    fontSize: "11px", fontWeight: "600", color: "#374151",
    display: "block", marginBottom: "3px",
    textTransform: "uppercase", letterSpacing: "0.03em",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  full: { gridColumn: "1 / -1" },
  section: {
    background: "#F8FAFF", border: "1px solid #E0EDFF",
    borderRadius: "10px", padding: "12px 14px", marginBottom: "10px",
  },
  sectionTitle: {
    fontSize: "12px", fontWeight: "700", color: "#1E40AF",
    marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px",
  },
  checkbox: {
    display: "flex", alignItems: "center", gap: "6px",
    fontSize: "12px", color: "#374151", cursor: "pointer",
  },
  checkGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "6px", marginBottom: "8px",
  },
  btnPrimary: {
    flex: 1, padding: "11px", background: "#0C4A6E", color: "white",
    border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: "6px",
  },
  btnSecondary: {
    padding: "11px 16px", background: "#F3F4F6", color: "#374151",
    border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer",
  },
  btnOutline: {
    padding: "11px 16px", background: "white", color: "#0C4A6E",
    border: "1.5px solid #0C4A6E", borderRadius: "8px", fontSize: "13px",
    fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
  },
};
