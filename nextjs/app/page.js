"use client";

import { useState } from "react";

export default function HomePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("Your message has been sent. Thank you!");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("Server error. Please try again later.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20 px-4">
      {/* TITLE SECTION */}
      <h1 className="text-4xl font-bold mb-6 text-gray-900 text-center">
        Welcome to <span className="text-purple-600">YourBarrio</span>
      </h1>
      <p className="text-gray-600 text-center max-w-lg mb-12">
        Connect with local businesses, discover hidden gems, and explore your neighborhood
        like never before.
      </p>

      {/* CONTACT FORM CARD */}
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Get in Touch
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* NAME */}
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* EMAIL */}
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* MESSAGE */}
          <textarea
            placeholder="Your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-3 py-2 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition disabled:bg-gray-400"
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>

        {/* STATUS MESSAGE */}
        {status && (
          <p className="mt-4 text-sm text-center text-gray-700">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
