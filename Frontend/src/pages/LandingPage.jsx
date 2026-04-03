import React from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Users,
  TrendingUp,
  Shield,
  FileText,
  BarChart3,
  ArrowRight,
  Lock,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-md ring-1 ring-white/10">
              <LayoutDashboard className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Super Admin</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Control plane
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
            <a href="#capabilities" className="transition-colors hover:text-slate-900">
              Capabilities
            </a>
            <a href="#platform" className="transition-colors hover:text-slate-900">
              Platform
            </a>
          </nav>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Sign in
            <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 40%)',
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-300/90" aria-hidden />
            Internal administration console
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Operate your platform with clarity and control
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            A single place to manage users, LLMs, prompts, documents, and compliance settings—built
            for operators who need precision, not noise.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-950/20 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <Lock className="h-4 w-4" aria-hidden />
              Access admin console
            </Link>
            <a
              href="#capabilities"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              View capabilities
            </a>
          </div>
          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/10 pt-10 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Scope
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">Users &amp; subscriptions</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                AI ops
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">Models, prompts &amp; limits</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Content
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">Templates &amp; documents</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Feature grid */}
      <section id="capabilities" className="scroll-mt-24 border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              What you can manage
            </h2>
            <p className="mt-3 text-slate-600">
              Core workflows administrators use daily—organized, auditable, and fast.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Scale,
                title: 'Operational oversight',
                body: 'Structure case-type content, courts, and related metadata from one consistent admin surface.',
              },
              {
                icon: Users,
                title: 'Identity & access',
                body: 'Provision users, review activity, and keep subscription and support tooling aligned.',
              },
              {
                icon: TrendingUp,
                title: 'Usage & analytics',
                body: 'Monitor token usage, sessions, and platform health without leaving the dashboard.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 transition group-hover:ring-blue-200/80">
                  <Icon className="h-5 w-5 text-slate-700" aria-hidden />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Platform highlights */}
      <section id="platform" className="scroll-mt-24 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Built for secure administration
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Enterprise expectations—without unnecessary complexity in the UI.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {[
              {
                icon: Shield,
                title: 'Security-first defaults',
                body: 'Authenticated routes, JWT sessions, and least-privilege patterns suitable for internal operators.',
              },
              {
                icon: BarChart3,
                title: 'Operational visibility',
                body: 'Dashboards and lists designed for scanning, triage, and follow-up—not vanity charts.',
              },
              {
                icon: FileText,
                title: 'Document & template control',
                body: 'Centralized handling of prompts, templates, and file flows your product teams depend on.',
              },
              {
                icon: Users,
                title: 'Collaboration-ready',
                body: 'Clear ownership of admin tasks with predictable navigation across modules.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <Icon className="h-6 w-6 text-slate-700" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-12 shadow-xl sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to sign in?
            </h2>
            <p className="mt-3 text-slate-300">
              Use your administrator credentials to open the console. Unauthorized access is
              prohibited.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Continue to login
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Shield className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="font-medium text-slate-700">Super Admin Portal</span>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-right">
            <span className="block sm:inline">&copy; {new Date().getFullYear()} All rights reserved.</span>
            <span className="mx-2 hidden text-slate-300 sm:inline">·</span>
            <span className="block sm:inline">Authorized personnel only</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
