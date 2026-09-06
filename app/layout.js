import './globals.css';
import Navbar from '@/components/navbar';

export const metadata = {
  title: 'Manga Ultra',
  description: 'A creator-upload platform for manga and novels.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Navbar />
        <main className="container py-10">{children}</main>
      </body>
    </html>
  );
}
