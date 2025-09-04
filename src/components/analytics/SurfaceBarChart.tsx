type Props = {
  data: Record<string, number>;
  distance?: number;
  duration?: number;
  bare?: boolean; // flag for bare mode
  style?: React.CSSProperties; // external container style
};

// Replace colons and underscores with spaces in labels
function cap(s: string) {
  return s.replace(/[:_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/* Helpers for textures */
const solid = (bg: string): React.CSSProperties => ({ backgroundColor: bg });
const stripes = (bg: string, line: string, size = 10, w = 4): React.CSSProperties => ({
  backgroundColor: bg,
  backgroundImage: `repeating-linear-gradient(135deg, ${line} 0 ${w}px, transparent ${w}px ${size}px)`,
  backgroundSize: `${size}px ${size}px`,
});
const dots = (bg: string, dot: string, size = 10, r = 2): React.CSSProperties => ({
  backgroundColor: bg,
  backgroundImage: `radial-gradient(${dot} ${r}px, transparent ${r}px)`,
  backgroundSize: `${size}px ${size}px`,
});
const cross = (bg: string, line: string, size = 10, w = 2): React.CSSProperties => ({
  backgroundColor: bg,
  backgroundImage: `
    repeating-linear-gradient(45deg,  ${line} 0 ${w}px, transparent ${w}px ${size}px),
    repeating-linear-gradient(-45deg, ${line} 0 ${w}px, transparent ${w}px ${size}px)
  `,
  backgroundSize: `${size}px ${size}px`,
});

/* Palette and textures */
const STYLE: Record<string, React.CSSProperties> = {
  asphalt: solid("#2f2f33"),
  rock: cross("#56657a", "#e2e8f0", 12, 2),
  gravel: dots("#8c5a2b", "#d8b48a", 12, 2),
  fine_gravel: stripes("#b79a80", "#6b533f", 8, 3),
  compacted: stripes("#c7b08b", "#8f7b5d", 8, 3),
  dirt: solid("#8a4b27"),
  ground: stripes("#cdb793", "#9a7d52", 12, 3),
  sand: dots("#e6cfa4", "#c4a36b", 12, 2),
  unpaved: solid("#e4e9ee"),
  paved: stripes("#cfd4da", "#808b98", 12, 3),
  concrete: stripes("#d9dee4", "#9aa7b6", 12, 3),
  concrete_plates: cross("#d9dee4", "#9aa7b6", 12, 2),
  paving_stones: stripes("#9aa4b2", "#5c6773", 8, 3),
  cobblestone: solid("#6b7280"),
  sett: solid("#444c57"),
  grass: dots("#6fb26a", "#cfe9d0", 12, 2),
  mud: dots("#6b3f2b", "#9b6a56", 12, 2),
  wood: stripes("#c89e6a", "#8b5e34", 12, 3),
  boardwalk: stripes("#c89e6a", "#8b5e34", 12, 3),
  metal: cross("#b8c6d6", "#7b8fa5", 12, 2),
  ice: solid("#cfe9ff"),
  snow: dots("#ffffff", "#dfe6ef", 12, 2),
  pebblestone: {
    backgroundColor: '#b79269',
    backgroundImage: `
      radial-gradient(circle, #7a5838 2px, transparent 2px),
      radial-gradient(circle, #d9be97 2px, transparent 2px)
    `,
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0, 6px 6px', // offset for the second layer
  },
  default: solid("#cfd6df"),
};

/* Aliases to normalize rare keys */
const ALIAS: Record<string, string> = {
  earth: "ground",
  bare_ground: "ground",
  soil: "ground",
  stone: "rock",
  bedrock: "rock",
  unhewn_cobblestone: "cobblestone",
  metal_grate: "metal",
  boardwalk: "wood",
  paving_stone: "paving_stones",
  "concrete:plates": "concrete_plates",
  pebble_stone: 'pebblestone',
  'pebble-stone': 'pebblestone',
  pebbles: 'pebblestone',
  pebble: 'pebblestone',
};

/* Display names for long keys */
const DISPLAY: Record<string, string> = {
  fine_gravel: "Fine Gravel",
  paving_stones: "Paving Stones",
  concrete_plates: "Concrete Plates",
  pebblestone: 'Pebblestone',
};

/* Auto-scaling */
const SCALE =
  new URLSearchParams(location.search).has("demo") ? 1 :
  window.matchMedia("(min-width:1400px)").matches ? 1 :
  window.matchMedia("(min-width:1024px)").matches ? 1 : 1;

// Main dimensions and spacing
const BAR_H = Math.round(24 * SCALE);
const BAR_WIDTH = Math.round(260 * SCALE);
const LABEL_W = Math.round(140 * SCALE);
const VALUE_W = Math.round(56 * SCALE);
const GAP = Math.round(12 * SCALE);
const PAD = Math.round(12 * SCALE);
const RADIUS = Math.round(8 * SCALE);

export const SurfaceBarTextChart = ({ data, distance, duration, bare = false, style }: Props) => {
  if (!data || Object.keys(data).length === 0) return <div>No surface data</div>;

  const items = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = items[0][1];

  const km = distance ? (distance / 1000).toFixed(2) : null;
  let timeStr: string | null = null;
  if (duration && duration > 0) {
    const m = Math.round(duration / 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    timeStr = h > 0 ? `${h} h${mm ? ` ${mm} min` : ""}` : `${mm} min`;
  }

  const containerStyle: React.CSSProperties = bare
    ? (style || {})
    : {
        background: "rgba(255,255,255,0.96)",
        padding: PAD,
        borderRadius: RADIUS,
        boxShadow: "0 12px 28px rgba(0,0,0,.18)",
        width: "clamp(200px, 20vw, 300px)",
        ...style,
      };

  return (
    <div style={containerStyle}>
      {(km || timeStr) && (
        <div style={{ marginBottom: GAP, fontWeight: 600, fontSize: 16 * SCALE, textAlign: "center", color: "#222" }}>
          {km && <span>Length: {km} km</span>}
          {km && timeStr && <span> &nbsp;•&nbsp; </span>}
          {timeStr && <span>Time: {timeStr}</span>}
        </div>
      )}

      {items.map(([rawKey, val]) => {
        const key = (ALIAS[rawKey] ?? rawKey).toLowerCase();
        const barStyle = STYLE[key] ?? STYLE.default;

        const pxWidth = Math.max(
          Math.round((val / max) * BAR_WIDTH),
          val > 0 ? 6 : 0
        );

        const label = DISPLAY[key] ?? cap(key);

        return (
          <div
            key={rawKey}
            style={{
              display: "flex",
              alignItems: "center",
              gap: GAP,
              marginBottom: GAP,
            }}
          >
            <div
              title={label}
              style={{
                width: LABEL_W,
                textAlign: "right",
                paddingRight: GAP / 2,
                fontWeight: 600,
                color: "#1f2937",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </div>
            <div style={{ width: BAR_WIDTH, background: "#eef1f4", height: BAR_H, borderRadius: RADIUS, overflow: "hidden" }}>
              <div style={{ width: pxWidth, height: "100%", transition: "width 220ms ease", ...barStyle }} />
            </div>
            <div style={{ width: VALUE_W, textAlign: "right", fontWeight: 700, color: "#111827" }}>
              {val.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

