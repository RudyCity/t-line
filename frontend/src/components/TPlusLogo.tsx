
export const TPlusLogo = ({ size = 16 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 512 512" 
    className="shrink-0"
    style={{ filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.4))' }}
  >
    <defs>
      <linearGradient id="glyph-grad-inline" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#06b6d4" />
      </linearGradient>
    </defs>
    <path 
      d="M 140 160 C 140 148.95 148.95 140 160 140 L 320 140 C 331.05 140 340 148.95 340 160 L 340 200 C 340 211.05 331.05 220 320 220 L 270 220 L 270 360 C 270 371.05 261.05 380 250 380 L 210 380 C 198.95 380 190 371.05 190 360 L 190 220 L 160 220 C 148.95 220 140 211.05 140 200 Z" 
      fill="url(#glyph-grad-inline)" 
    />
    <path 
      d="M 330 280 C 330 274.48 334.48 270 340 270 L 360 270 L 360 250 C 360 244.48 364.48 240 370 240 L 390 240 C 395.52 240 400 244.48 400 250 L 400 270 L 420 270 C 425.52 270 430 274.48 430 280 L 430 300 C 430 305.52 425.52 310 420 310 L 400 310 L 400 330 C 400 335.52 395.52 340 390 340 L 370 340 C 364.48 340 360 335.52 360 330 L 360 310 L 340 310 C 334.48 310 330 305.52 330 300 Z" 
      fill="#ffffff" 
    />
  </svg>
);
