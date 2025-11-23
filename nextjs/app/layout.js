import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import ServerNavbarWrapper from "./ServerNavbarWrapper";
import Footer from "@/components/Footer";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "YourBarrio – Find What You Need Nearby",
  description: "YourBarrio neighborhood discovery landing page",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="pt-20">
      <div className="animated-bg"></div>
        <ServerNavbarWrapper />
        {children}
        <Footer />
      </body>
    </html>
    
  );
}
