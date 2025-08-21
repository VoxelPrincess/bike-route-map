


type Props = {
  data: Record<string, number>;
  distance?: number;
  duration?: number;
};

function formatSurfaceLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export const SurfaceBarTextChart = ({ data, distance, duration }: Props) => {
  if (!data || Object.keys(data).length === 0) return <div>No surface data</div>;

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const maxValue = sorted[0][1];


  // Length formatting
  const km = distance ? (distance / 1000).toFixed(2) : null;

  // Time formatting: if more than an hour, show "1 h 12 min"
  let timeStr: string | null = null;
  if (duration && duration > 0) {
    const totalMin = Math.round(duration / 60);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hours > 0) {
      timeStr = `${hours} h ${mins > 0 ? ` ${mins} min` : ''}`;
    } else {
      timeStr = `${mins} min`;
    }
  }

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 6 }}>
      {(km || timeStr) && (
        <div style={{ marginBottom: 12, fontWeight: 500, fontSize: '1rem', color: '#222', textAlign: 'center' }}>
          {km && <span>Length: {km} km</span>}
          {km && timeStr && <span> &nbsp;•&nbsp; </span>}
          {timeStr && <span>Time: {timeStr}</span>}
        </div>
      )}

      {sorted.map(([type, value]) => {
        const widthPercent = (value / maxValue) * 100;

        // Texture styles for some surfaces
        let texture: React.CSSProperties = {};
        if (type === 'asphalt') {
          texture = {
            backgroundColor: '#4b4b4bff',
          };
        } else if (type === 'grass') {
          texture = {
            backgroundImage: `repeating-linear-gradient(135deg, #6b8e23 0 4px, #b6d97a 4px 8px)`,
            backgroundColor: '#6b8e23',
          };
        } else if (type === 'concrete') {
          texture = {
            backgroundImage: `repeating-linear-gradient(135deg, #cccccc 0 6px, #eeeeee 6px 12px)`,
            backgroundColor: '#cccccc',
          };
        } else if (type === 'paving_stones') {
          texture = {
            backgroundImage: `repeating-linear-gradient(90deg, #666666 0 4px, #bbbbbb 4px 8px)`,
            backgroundColor: '#bbbbbb',
          };
        } else if (type === 'paved') {
          texture = {
            backgroundImage: `repeating-linear-gradient(135deg, #bbbbbb 0 6px, #e0e0e0 6px 12px)`,
            backgroundColor: '#bbbbbb',
          };
        } else if (type === 'wood') {
          texture = {
            backgroundImage: `repeating-linear-gradient(120deg, #deb887 0 8px, #a0522d 8px 16px)`,
            backgroundColor: '#deb887',
          };
        } else if (type === 'dirt') {
          texture = {
            backgroundColor: '#a0522d',
          };
        } else if (type === 'cobblestone') {
          texture = {
            backgroundColor: '#708090',
          };
        } else if (type === 'sett') {
          texture = {
            backgroundColor: '#555555',
          };
        } else if (type === 'concrete:plates') {
          texture = {
            backgroundColor: '#AAAAAA',
          };
        } else if (type === 'gravel') {
          texture = {
            backgroundImage: `radial-gradient(circle, #8B4513 1.5px, transparent 1.5px), radial-gradient(circle, #bfa27a 1.5px, transparent 1.5px)`,
            backgroundSize: '8px 8px',
            backgroundColor: '#8B4513',
          };
        } else if (type === 'sand') {
          texture = {
            backgroundImage: `radial-gradient(circle, #e2c290 2px, transparent 2px)`,
            backgroundSize: '10px 10px',
            backgroundColor: '#e2c290',
          };
        } else if (type === 'compacted') {
          texture = {
            backgroundImage: `repeating-linear-gradient(45deg, #bfa27a 0 3px, #e2c290 3px 6px)`,
            backgroundColor: '#bfa27a',
          };
        } else {
          texture = {
            backgroundColor: '#cccccc'
          };
        }

        return (
          <div key={type} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 100, textAlign: 'right', paddingRight: 10 }}>
                {formatSurfaceLabel(type)}
              </div>
              <div style={{
                flex: 1,
                background: '#e0e0e0',
                height: 20,
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${widthPercent}%`,
                  height: '100%',
                  ...texture
                }} />
              </div>
              <div style={{ width: 48, textAlign: 'right', marginLeft: 8 }}>
                {value.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
