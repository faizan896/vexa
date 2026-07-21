"use client";

/**
 * Forecastly mark — head-in-profile with a 6-point asterisk (the "thinking" spark).
 * Recreated from the brand reference, colored to match the app palette.
 */
export default function Logo({ size = 30, head = "#f5efe6", spark = "#3a2620" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-label="Forecastly logo" style={{ display: "block" }}>
      <path
        d="M258 52c108 0 178 74 178 170v238H278v-72h-88v-70h-64l44-84v-60c0-70 34-122 88-122z"
        fill={head}
      />
      <g stroke={spark} strokeWidth="34" strokeLinecap="butt">
        <line x1="300" y1="112" x2="300" y2="268" />
        <line x1="232" y1="151" x2="368" y2="229" />
        <line x1="232" y1="229" x2="368" y2="151" />
      </g>
    </svg>
  );
}
