import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
export const metadata:Metadata={title:'حسابینو | مدیریت مالی',description:'سامانه فارسی حسابداری و مدیریت مالی'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
