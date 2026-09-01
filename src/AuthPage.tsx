import { useState } from "react"
import { AuthError } from "@supabase/supabase-js"
import { supabase } from "./lib/supabase"

type AuthMode = "login" | "signup"

function authErrorMessage(error: unknown) {
  if (!(error instanceof AuthError)) return "网络连接失败，请检查网络后重试。"

  switch (error.code) {
    case "invalid_credentials":
      return "邮箱或密码不正确，请检查后重试。"
    case "email_not_confirmed":
      return "请先打开验证邮件并确认邮箱。"
    case "user_already_exists":
      return "该邮箱已经注册，请直接登录。"
    case "weak_password":
      return "密码强度不足，请使用至少 6 位字符。"
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "请求过于频繁，请稍后再试。"
    default:
      return error.message ? `认证失败：${error.message}` : "认证失败，请稍后重试。"
  }
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError("")
    setSuccess("")
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setSubmitting(true)

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setSuccess("注册成功！请打开验证邮件确认邮箱，然后返回登录。")
          setMode("login")
        }
      }
    } catch (submitError) {
      setError(authErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-full bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="grid grid-cols-2 gap-1 w-10 h-10 rounded-2xl bg-indigo-600 p-2 shadow-lg shadow-indigo-200">
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-white/45" />
            <span className="rounded-sm bg-white/45" />
            <span className="rounded-sm bg-white/75" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            FocusFlow
          </span>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login"
              ? "登录后继续专注今天的重要任务。"
              : "使用邮箱和密码开始使用 FocusFlow。"}
          </p>

          <div
            className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"
            aria-label="认证方式"
          >
            {(["login", "signup"] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeMode(item)}
                disabled={submitting}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  mode === item
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                邮箱
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                密码
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                placeholder="至少 6 位字符"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
              >
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "请稍候…" : mode === "login" ? "登录" : "创建账号"}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
