import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-primary-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to your analytics account</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-12 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M17.94 17.94A10 10 0 0 1 6.06 6.06m1.64-1.64A10 10 0 0 1 21.94 12 10 10 0 0 1 12 21.94a9.96 9.96 0 0 1-7.08-2.92" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M1.42 12.71C2.73 15.4 5.3 17.5 8.46 18.18a9.94 9.94 0 0 0 7.08-1.63 9.96 9.96 0 0 0 3.75-4.7 9.9 9.9 0 0 0-1.03-9.46A9.96 9.96 0 0 0 12 3.06a9.96 9.96 0 0 0-7.08 2.92" />
                    <path d="M12 8a4 4 0 0 1 4 4" />
                    <path d="M12 16a4 4 0 0 1-4-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#64ffda] py-2.5 font-medium text-[#0a192f] transition hover:bg-[#4fd1b8] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">
                  Demo Account
                </p>
                <p className="text-xs text-slate-500">
                  Click to auto-fill credentials
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEmail('sahasra@gmail.com')
                  setPassword('sahasra1230')
                }}
                className="rounded-lg bg-[#64ffda] px-4 py-2 text-sm font-medium text-[#0a192f] hover:bg-[#4fd1b8]"
              >
                Use Demo
              </button>
            </div>
          </div>

        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/register" className="font-medium text-primary-600 hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}
