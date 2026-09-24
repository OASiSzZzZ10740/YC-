import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'YC เพื่อนที่ปรึกษา', description: 'พื้นที่รับฟังสำหรับนักเรียน' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
