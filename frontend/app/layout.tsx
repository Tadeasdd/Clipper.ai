import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clipper — AI clips from your podcast',
  description:
    'Upload a podcast, get back the moments worth posting — scored, captioned, and cut for every platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
