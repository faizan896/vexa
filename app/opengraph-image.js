import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Forecastly — Financial modeling for everyone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#3a2620",
          color: "#f5efe6",
          fontFamily: "Georgia, serif",
        }}
      >
        <svg width="130" height="130" viewBox="0 0 512 512" fill="none">
          <path
            d="M258 52c108 0 178 74 178 170v238H278v-72h-88v-70h-64l44-84v-60c0-70 34-122 88-122z"
            fill="#f5efe6"
          />
          <line x1="300" y1="112" x2="300" y2="268" stroke="#3a2620" strokeWidth="34" />
          <line x1="232" y1="151" x2="368" y2="229" stroke="#3a2620" strokeWidth="34" />
          <line x1="232" y1="229" x2="368" y2="151" stroke="#3a2620" strokeWidth="34" />
        </svg>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: 4, marginTop: 28 }}>
          <span>FORECAST</span>
          <span style={{ color: "#b08d3f" }}>LY</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#cbbfae", marginTop: 14 }}>
          Model any listed company in minutes — no Excel required
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#b08d3f", marginTop: 34, letterSpacing: 3 }}>
          3-STATEMENT · DCF · SCENARIOS · SENSITIVITY · M&A · LBO
        </div>
      </div>
    ),
    { ...size }
  );
}
