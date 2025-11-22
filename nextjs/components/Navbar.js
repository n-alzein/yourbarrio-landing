"use client";

import { useState } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function Navbar({ user }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white shadow-md fixed top-0 left-0 w-full z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* LOGO */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-purple-600">
              YourBarrio
            </span>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex space-x-6 items-center">
            <Link href="/businesses" className="hover:text-purple-600">
              Businesses
            </Link>

            <Link href="/about" className="hover:text-purple-600">
              About
            </Link>

            {!user ? (
              <>
                <Link href="/login" className="hover:text-purple-600">
                  Login
                </Link>

                <Link
                  href="/register"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/profile" className="hover:text-purple-600">
                  Profile
                </Link>

                <LogoutButton />
              </>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            className="md:hidden text-gray-800"
            onClick={() => setOpen(!open)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {open && (
        <div className="md:hidden bg-white shadow-md">
          <div className="px-6 py-4 flex flex-col space-y-4">

            <Link
              href="/businesses"
              onClick={() => setOpen(false)}
              className="hover:text-purple-600"
            >
              Businesses
            </Link>

            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="hover:text-purple-600"
            >
              About
            </Link>

            {!user ? (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="hover:text-purple-600"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-center"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="hover:text-purple-600"
                >
                  Profile
                </Link>

                <LogoutButton mobile />
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
