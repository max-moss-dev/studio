"use client"

import { useState } from "react"
import { Layers, Sparkles, Zap, Code, Share2, BrainCircuit, ArrowRight, CheckCircle, Play } from "lucide-react"

export default function LandingPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    // Store signup locally (replace with real endpoint)
    try {
      const existing = JSON.parse(localStorage.getItem("studio-signups") ?? "[]")
      existing.push({ email: email.trim(), timestamp: Date.now() })
      localStorage.setItem("studio-signups", JSON.stringify(existing))
    } catch {}
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#282c34]">
            <Layers className="h-4.5 w-4.5 text-[#61afef]" />
          </div>
          <span className="text-lg font-bold">Studio</span>
        </div>
        <a
          href="/"
          className="text-sm text-[#61afef] hover:text-[#61afef]/80 transition-colors"
        >
          Launch App &rarr;
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#3e4451] bg-[#1e2127] px-4 py-1.5 text-sm text-[#abb2bf] mb-8">
          <Sparkles className="h-3.5 w-3.5 text-[#e5c07b]" />
          AI-powered view builder for agent teams
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
          Build views for your
          <br />
          <span className="bg-gradient-to-r from-[#61afef] via-[#c678dd] to-[#e5c07b] bg-clip-text text-transparent">
            AI agents
          </span>
          {" "}on the fly
        </h1>

        <p className="text-lg text-[#abb2bf] max-w-2xl mx-auto mb-10 leading-relaxed">
          Studio lets you describe what you want, and your AI agents build the React view
          for you. Edit, preview, and share — all from your browser.
        </p>

        {/* CTA */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-[#3e4451] bg-[#1e2127] px-4 py-3 text-sm text-white placeholder:text-[#5c6370] focus:outline-none focus:ring-2 focus:ring-[#61afef] focus:border-transparent"
              required
            />
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-[#61afef] px-6 py-3 text-sm font-medium text-white hover:bg-[#61afef]/90 transition-colors shrink-0"
            >
              Get Early Access
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 justify-center text-[#98c379]">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">You&apos;re on the list! We&apos;ll notify you when Studio launches.</span>
          </div>
        )}
      </section>

      {/* Video/Demo placeholder */}
      <section className="max-w-4xl mx-auto px-8 pb-20">
        <div className="relative rounded-2xl border border-[#3e4451] bg-[#1e2127] overflow-hidden aspect-video flex items-center justify-center group cursor-pointer">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#61afef]/5 via-transparent to-[#c678dd]/5" />

          {/* Play button */}
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#61afef]/20 border border-[#61afef]/30 group-hover:bg-[#61afef]/30 transition-colors">
              <Play className="h-7 w-7 text-[#61afef] ml-1" />
            </div>
            <span className="text-sm text-[#abb2bf]">Watch how Studio builds views in real-time</span>
          </div>

          {/* Fake browser chrome */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-[#282c34] flex items-center gap-2 px-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e06c75]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e5c07b]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#98c379]" />
            </div>
            <div className="flex-1 flex justify-center">
              <span className="text-[10px] text-[#5c6370] font-mono">studio.yourdomain.com</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything you need to manage AI agents
        </h2>
        <p className="text-[#abb2bf] text-center mb-16 max-w-2xl mx-auto">
          From monitoring to building custom views, Studio gives you full control
          over your agent workforce.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Sparkles,
              title: "AI View Builder",
              description: "Describe what you want, get a React view. Edit code with live preview. Share as JSON packages.",
              color: "#e5c07b",
            },
            {
              icon: BrainCircuit,
              title: "Multi-Provider",
              description: "Connect to OpenClaw Gateway, Claude Code, or OpenAI Codex. One UI for all your agents.",
              color: "#c678dd",
            },
            {
              icon: Code,
              title: "Sandpack Editor",
              description: "Full code editor with syntax highlighting, live preview, and npm package support in the browser.",
              color: "#98c379",
            },
            {
              icon: Share2,
              title: "Agent Network",
              description: "Force-directed graph showing real-time agent communication. Click to chat, drag to arrange.",
              color: "#61afef",
            },
            {
              icon: Zap,
              title: "Real-time Updates",
              description: "WebSocket connection for instant agent status, messages, and task updates. No polling.",
              color: "#e06c75",
            },
            {
              icon: Layers,
              title: "Plugin System",
              description: "Import/export views as JSON. Install from URLs. Build a library of reusable agent views.",
              color: "#d19a66",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-[#3e4451] bg-[#1e2127] p-6 hover:border-[#5c6370] transition-colors"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg mb-4"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-[#abb2bf] leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto px-8 pb-20 text-center">
        <div className="rounded-2xl border border-[#3e4451] bg-gradient-to-br from-[#1e2127] to-[#282c34] p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to try Studio?</h2>
          <p className="text-[#abb2bf] mb-8 max-w-lg mx-auto">
            Join the waitlist for early access, or launch the app now with mock data to explore.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/"
              className="flex items-center gap-2 rounded-lg bg-[#61afef] px-6 py-3 text-sm font-medium text-white hover:bg-[#61afef]/90 transition-colors"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3e4451] py-8">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#5c6370]" />
            <span className="text-sm text-[#5c6370]">Studio v0.1.0</span>
          </div>
          <span className="text-sm text-[#5c6370]">Built for AI agent teams</span>
        </div>
      </footer>
    </div>
  )
}
