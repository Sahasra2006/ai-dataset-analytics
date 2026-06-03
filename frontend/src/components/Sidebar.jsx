import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/upload', label: 'Upload Dataset', icon: '📤' },
  { to: '/ml', label: 'Train ML Model', icon: '🤖' },
  { to: '/chat', label: 'AI Chat', icon: '💬' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-lg font-bold text-primary-700">Dataset Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">AI-powered insights</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-medium text-slate-700">{user?.name}</p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
