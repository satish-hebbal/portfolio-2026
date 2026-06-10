// Hand-drawn style curved arrow, used to point at interactive elements
export const SketchyArrow = ({
  className = '',
  color = '#f97316',
  flip = false,
  rotate = 0,
  width = 46,
  height = 60,
}: {
  className?: string;
  color?: string;
  flip?: boolean;
  rotate?: number;
  width?: number;
  height?: number;
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 70 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ transform: `${flip ? 'scaleX(-1) ' : ''}rotate(${rotate}deg)` }}
  >
    {/* shaft, drawn twice with a slight offset for a sketchy double-stroke */}
    <path d="M62 6 C 40 2, 12 24, 16 52 C 18 68, 24 76, 30 82" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M63 8 C 42 5, 14 26, 18 53 C 19 69, 25 77, 31 83" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.45" />
    {/* arrowhead */}
    <path d="M14 67 C 19 74, 25 79, 31 83" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M39 70 C 35 75, 33 79, 31 83" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
