import { useId, type CSSProperties, type ReactNode } from "react";

function RobotArm() {
  return (
    <g>
      <path d="M187 177h82l-9-15h-61z" fill="var(--drawing-fill)" />
      <path
        d="m223 161-24-48 39-44 32 22"
        strokeWidth="12"
        stroke="var(--drawing-fill)"
      />
      <path d="m223 161-24-48 39-44 32 22" />
      <circle cx="199" cy="113" r="9" fill="var(--drawing-paper)" />
      <circle cx="238" cy="69" r="8" fill="var(--drawing-paper)" />
      <path d="m270 91 9 10-7 13m7-13 12 3" />
    </g>
  );
}

function Screen({ children }: { children?: ReactNode }) {
  return (
    <g>
      <rect
        x="46"
        y="59"
        width="119"
        height="91"
        rx="7"
        fill="var(--drawing-paper)"
      />
      <path d="M46 77h119m-65 73v17m-22 0h44" />
      <circle cx="57" cy="68" r="1" />
      <circle cx="64" cy="68" r="1" />
      {children}
    </g>
  );
}

// Concept drawings, not depictions of specific products or research results.
const scenes: Record<string, ReactNode> = {
  "synthesis-o01": (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 10} ${i * -9})`}>
          <rect
            x="48"
            y="78"
            width="61"
            height="79"
            rx="4"
            fill="var(--drawing-paper)"
          />
          <path d="M60 95h25m-25 10h36m-36 10h30" />
        </g>
      ))}
      <path
        d="M139 79 188 103h20m-69 43 49-23h20m-69-11h69"
        strokeDasharray="3 5"
      />
      <rect
        x="226"
        y="79"
        width="67"
        height="67"
        rx="10"
        fill="var(--drawing-fill)"
      />
      <rect x="243" y="96" width="33" height="33" rx="4" />
      {[91, 109, 127].map((y) => (
        <path key={y} d={`M219 ${y}h7m67 0h7`} />
      ))}
      <path d="M251 72v7m18-7v7m-18 67v8m18-8v8" />
    </>
  ),
  "synthesis-o02": (
    <>
      <Screen>
        <path d="m62 95 4 4 7-8m8 4h35m-54 20 4 4 7-8m8 4h56m-75 20h40" />
      </Screen>
      <path d="M165 124h20v-20h14" strokeDasharray="4 5" />
      <RobotArm />
    </>
  ),
  "compact-survey-maps": (
    <>
      <g
        stroke="var(--signal-spectrum)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path
          d="m96 180 142-70 146 73-142 70Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".07"
        />
        <path
          d="m150 153 44-23 46 24-43 23Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".13"
        />
        <path d="m150 153 0 37 47 24 0-37m0 37 43-22v-38" />
        <path
          d="m260 178 41-22 41 21-42 23Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".2"
        />
        <path d="m260 178 0 23 40 22v-23m0 23 42-22v-24" />
        <path d="m237 124 39-18 36 17-39 20Z" />
        <path
          className="scan-beam"
          d="m260 79-164 101m164-101 124 104"
          strokeDasharray="4 6"
          opacity=".5"
        />
        <g className="floating-object">
          <path d="m225 53 33 17 34-17m-67 34 33-17 34 17" strokeWidth="3" />
          <ellipse cx="221" cy="52" rx="17" ry="7" />
          <ellipse cx="296" cy="52" rx="17" ry="7" />
          <ellipse cx="221" cy="88" rx="17" ry="7" />
          <ellipse cx="296" cy="88" rx="17" ry="7" />
          <path
            d="m244 66 14-7 15 7v10l-15 8-14-8Z"
            fill="var(--signal-spectrum)"
            fillOpacity=".25"
          />
        </g>
      </g>
      <circle
        className="signal-pulse"
        cx="242"
        cy="232"
        r="4"
        fill="var(--signal-spectrum)"
      />
    </>
  ),
  "generated-training-review": (
    <>
      <g
        stroke="var(--signal-spectrum)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <path
          d="m98 156 89-48 92 48-92 51Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".04"
        />
        <path
          d="m157 136 31-16 30 16-31 18Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".15"
        />
        <path d="m157 136 0 33 30 16v-31m0 31 31-17v-32" />
        <path
          d="m260 104 62-32 61 32-61 34Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".08"
        />
        <path d="m293 91 28-15 28 15-28 16Z" />
        <path d="m293 91 0 26 28 16v-26m0 26 28-16V91" />
        <path
          d="m260 206 62-32 61 32-61 34Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".08"
        />
        <circle
          cx="321"
          cy="203"
          r="19"
          fill="var(--signal-spectrum)"
          fillOpacity=".15"
        />
        <path
          className="moving-path"
          d="M213 136q38-46 73-31m-73 41q33 64 73 62"
          strokeDasharray="4 7"
        />
        <path d="M188 116V78l-44-24-37 20v20m-9-2 9 9 9-9" strokeWidth="3" />
        <circle cx="188" cy="78" r="5" fill="var(--signal-spectrum)" />
        <circle cx="144" cy="54" r="5" fill="var(--signal-spectrum)" />
      </g>
    </>
  ),
  "factory-robot-setup": (
    <>
      <g
        stroke="var(--signal-spectrum)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          d="m80 198 123-56 123 59-123 56Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".04"
        />
        <path
          d="m106 195 36-18 37 18-37 18Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".18"
        />
        <path d="m106 195 0 18 36 18v-18m0 18 37-18v-18" />
        <path d="M142 185v-65l61-43 61 33" strokeWidth="13" opacity=".18" />
        <path d="M142 185v-65l61-43 61 33" strokeWidth="3" />
        <circle
          cx="142"
          cy="120"
          r="10"
          fill="var(--signal-spectrum)"
          fillOpacity=".15"
        />
        <circle
          cx="203"
          cy="77"
          r="10"
          fill="var(--signal-spectrum)"
          fillOpacity=".15"
        />
        <path d="m257 112 0 25 16 9 12-8v-15" strokeWidth="3" />
        <path
          d="m233 178 40-20 41 20-41 23Z"
          fill="var(--signal-spectrum)"
          fillOpacity=".12"
        />
        <path d="m233 178 0 33 40 20v-30m0 30 41-20v-33" />
        <path
          className="moving-path"
          d="M338 78h41v39m-26 0 26-26m-32 62h32v38"
          strokeDasharray="4 5"
          opacity=".6"
        />
        <circle cx="352" cy="77" r="17" opacity=".35" />
      </g>
    </>
  ),
  "everyday-leg-assistance": (
    <>
      <circle cx="171" cy="48" r="13" fill="var(--drawing-paper)" />
      <path
        d="m166 64-15 50 30 25 16 42h23m-69-67-11 37-31 26H91m69-98-22 20-25-7m49-22 21 24 23 3"
        strokeWidth="5"
      />
      <path
        d="m154 104 34 30 15 40m-49-70-6 49-31 27"
        stroke="var(--drawing-accent)"
        strokeWidth="8"
      />
      <circle cx="154" cy="104" r="9" fill="var(--drawing-fill)" />
      <circle cx="188" cy="134" r="7" fill="var(--drawing-paper)" />
      <path
        d="M72 188h189m-11-54 11 7-12 7m-6-37 17 11-18 11"
        strokeDasharray="3 5"
      />
    </>
  ),
  "ai-action-controls": (
    <>
      <Screen>
        <path d="M62 95h58m-58 13h39m-39 13h53" />
      </Screen>
      <path d="M165 113h25" strokeDasharray="4 5" />
      <path
        d="m239 63 42 16v36c0 28-26 45-42 52-16-7-42-24-42-52V79z"
        fill="var(--drawing-fill)"
      />
      <path d="m221 112 13 13 25-29" strokeWidth="4" />
    </>
  ),
  "automated-lab-experiments": (
    <>
      <path d="M51 174h244M75 174V64h126v42m-10-12h20v22h-20z" />
      <path d="M68 64h14v110H68z" fill="var(--drawing-fill)" />
      <path d="M201 116v17m-4 6 4 7 4-7" />
      <path d="M112 138h138v32H112z" fill="var(--drawing-paper)" />
      {[128, 151, 174, 197, 220, 239].map((x) => (
        <ellipse
          key={x}
          cx={x}
          cy="148"
          rx="5"
          ry="3"
          fill="var(--drawing-fill)"
        />
      ))}
      <path d="M269 123v27c0 11 18 11 18 0v-27m-21 0h24" />
    </>
  ),
  "hardware-code-testing": (
    <>
      <Screen>
        <path d="m64 105 10-8-10-8m19 24h20m-39 20h62" />
      </Screen>
      <path d="M151 150v22h43v-45h21" />
      <rect
        x="215"
        y="84"
        width="79"
        height="69"
        rx="5"
        fill="var(--drawing-fill)"
      />
      <rect x="232" y="101" width="30" height="29" rx="2" />
      <path d="M240 93v8m13-8v8m-13 29v8m13-8v8m-29-29h8m-8 13h8m30-13h9m-9 13h9" />
      <circle cx="281" cy="96" r="3" />
      <circle cx="281" cy="141" r="3" />
    </>
  ),
  "checked-part-designs": (
    <>
      <path
        d="m64 106 66-38 62 34v59l-66 38-62-35z"
        fill="var(--drawing-fill)"
      />
      <path d="m64 106 62 35 66-39m-66 39v58m-39-79v28l25 14m18-94v61" />
      <path
        d="m54 85 64-37m-64 31v12m64-49v12m91 46v63m-5-63h10m-10 63h10"
        strokeDasharray="2 4"
      />
      <circle cx="259" cy="120" r="30" fill="var(--drawing-paper)" />
      <path d="m244 120 10 10 21-24" strokeWidth="3" />
    </>
  ),
  "laundry-folding": (
    <>
      <path d="M48 166h244m-223 0v20m201-20v20" />
      <path
        d="m85 101 26-14 10 10 10-10 27 14-12 26-10-6v36H104v-36l-9 6z"
        fill="var(--drawing-fill)"
      />
      <path d="M113 103v40m14-40v40" strokeDasharray="3 5" />
      <path
        d="M201 152h64v12h-64zm4-14h56v14h-56zm6-14h44v14h-44z"
        fill="var(--drawing-paper)"
      />
      <path d="M68 86V58h172v48m-8-7 8 8 8-8" />
    </>
  ),
  "protective-clothing-cooling": (
    <>
      <path
        d="m122 70 25-12h36l25 12 27 69-23 9-17-39v70h-59v-70l-17 39-23-9z"
        fill="var(--drawing-paper)"
      />
      <path d="M147 58c-4-39 40-39 36 0m-36 0 18 18 18-18m-18 18v103" />
      <path
        d="M146 94v65h10V94m19 0v65h10V94"
        stroke="var(--drawing-accent)"
        strokeWidth="4"
      />
      <path
        d="M68 94c20-15 21 14 40 0M57 116c20-15 21 14 40 0m147-22c20-15 21 14 40 0m-32 22c20-15 21 14 40 0"
        strokeDasharray="3 5"
      />
    </>
  ),
};

const originals = new Set([
  "compact-survey-maps",
  "generated-training-review",
  "factory-robot-setup",
]);

export function SignalVisual({ id }: { id: string }) {
  const gradient = `lead-spectrum-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scene = Object.hasOwn(scenes, id) ? scenes[id] : null;
  if (!scene) return null;
  return (
    <div
      className="signal-visual"
      style={{ "--signal-spectrum": `url(#${gradient})` } as CSSProperties}
      aria-hidden="true"
    >
      <svg
        viewBox={originals.has(id) ? "60 25 360 240" : "30 25 280 180"}
        fill="none"
        stroke="var(--signal-spectrum)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={gradient}
            x1={originals.has(id) ? 60 : 30}
            y1="25"
            x2={originals.has(id) ? 400 : 300}
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#aa8caf" />
            <stop offset=".22" stopColor="#8197bb" />
            <stop offset=".44" stopColor="#6aada8" />
            <stop offset=".65" stopColor="#a4b574" />
            <stop offset=".83" stopColor="#c8a66b" />
            <stop offset="1" stopColor="#c58a89" />
          </linearGradient>
        </defs>
        <g strokeWidth=".65" opacity=".13">
          {(originals.has(id)
            ? [80, 120, 160, 200, 240, 280, 320, 360, 400]
            : [50, 90, 130, 170, 210, 250, 290]
          ).map((x) => (
            <path key={x} d={`M${x} 42v${originals.has(id) ? 196 : 145}`} />
          ))}
          {(originals.has(id)
            ? [60, 100, 140, 180, 220]
            : [60, 100, 140, 180]
          ).map((y) => (
            <path key={y} d={`M40 ${y}h${originals.has(id) ? 384 : 260}`} />
          ))}
        </g>
        {scene}
      </svg>
    </div>
  );
}
