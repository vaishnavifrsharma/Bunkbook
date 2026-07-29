import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 110,
          background: '#FFFBF5',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          border: '8px solid #1C1A17',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        📓
      </div>
    ),
    { ...size }
  );
}
