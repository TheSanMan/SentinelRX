import { useRef } from "react";

/** Decorative molecular field. Pointer movement changes its perspective without React rerenders. */
export default function OrbitalField() {
  const field = useRef<HTMLDivElement>(null);
  return (
    <div
      className="orbital-field"
      ref={field}
      aria-hidden="true"
      onPointerMove={(event) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          return;
        const box = event.currentTarget.getBoundingClientRect();
        field.current?.style.setProperty(
          "--tilt-x",
          `${(event.clientY - box.top - box.height / 2) / -16}deg`,
        );
        field.current?.style.setProperty(
          "--tilt-y",
          `${(event.clientX - box.left - box.width / 2) / 16}deg`,
        );
      }}
      onPointerLeave={() => {
        field.current?.style.setProperty("--tilt-x", "0deg");
        field.current?.style.setProperty("--tilt-y", "0deg");
      }}
    >
      <div className="field-grid" />
      <div className="orbital-perspective">
        <svg viewBox="0 0 440 310" className="orbital-svg">
          <defs>
            <radialGradient id="sphere">
              <stop stopColor="#ccf3ea" />
              <stop offset="1" stopColor="#83cdc1" stopOpacity=".06" />
            </radialGradient>
          </defs>
          <circle cx="220" cy="151" r="103" fill="url(#sphere)" />
          <g
            className="orbital-rings"
            fill="none"
            stroke="currentColor"
            strokeWidth=".65"
          >
            <circle cx="220" cy="151" r="103" />
            <ellipse
              cx="220"
              cy="151"
              rx="103"
              ry="36"
              transform="rotate(-35 220 151)"
            />
            <ellipse
              cx="220"
              cy="151"
              rx="103"
              ry="36"
              transform="rotate(35 220 151)"
            />
            <ellipse cx="220" cy="151" rx="37" ry="103" />
            <ellipse cx="220" cy="151" rx="72" ry="103" />
            <ellipse cx="220" cy="151" rx="103" ry="72" />
            <ellipse
              cx="220"
              cy="151"
              rx="137"
              ry="53"
              transform="rotate(-25 220 151)"
              strokeDasharray="2 5"
            />
          </g>
          <g className="orbit-traveler">
            <circle cx="220" cy="48" r="5" fill="#0d3d38" />
            <circle
              cx="220"
              cy="48"
              r="11"
              fill="none"
              stroke="#53b9ab"
              strokeWidth=".7"
            />
          </g>
          <g className="orbit-traveler reverse">
            <circle cx="220" cy="254" r="4" fill="#008573" />
          </g>
          <g className="field-center">
            <rect
              x="207"
              y="138"
              width="26"
              height="26"
              rx="6"
              fill="#0d3d38"
            />
            <path d="M220 144v14m-7-7h14" stroke="#ccf3ea" strokeWidth="1.4" />
          </g>
          <g fill="currentColor" fontSize="9" fontFamily="monospace">
            <text x="34" y="61">
              01 — IDENTIFY
            </text>
            <text x="307" y="266">
              02 — UNDERSTAND
            </text>
          </g>
          <g stroke="currentColor" strokeWidth=".6" fill="none">
            <path d="M115 65h22l19 20M290 219l23 31h63" />
            <circle cx="156" cy="85" r="3" />
            <circle cx="290" cy="219" r="3" />
          </g>
        </svg>
      </div>
      <span className="field-caption">
        A little clarity. A better connection.
      </span>
    </div>
  );
}
