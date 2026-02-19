import './globals.css';

export const metadata = {
  title: 'Taskboard',
  description: 'Minimal priority task tracker'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
