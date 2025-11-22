import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Navbar from "@/components/Navbar";
import { supabaseServer } from "@/lib/supabase";




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


export default async function RootLayout({ children }) {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  return (
    <html lang="en">
      <body className="pt-20">
        <Navbar user={user} />
        {children}
      </body>
    </html>
  );
}