import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BunkBook — College Attendance Diary',
    short_name: 'BunkBook',
    description: 'Track your college attendance, log bunks, and calculate how many classes you can skip.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FFFBF5',
    theme_color: '#1C1A17',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
