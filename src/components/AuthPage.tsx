import { useState } from 'react'
import { Eye, EyeOff, MapPin, Loader2 } from 'lucide-react'
import './AuthPage.css'

interface AuthPageProps {
  mode: 'login' | 'register'
  onSetMode: (mode: 'login' | 'register') => void
  email: string
  onEmailChange: (v: string) => void
  password: string
  onPasswordChange: (v: string) => void
  error: string | null
  isSubmitting: boolean
  onSubmit: () => void
}

export function AuthPage({
  mode,
  onSetMode,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  error,
  isSubmitting,
  onSubmit,
}: AuthPageProps) {
  const [showPwd, setShowPwd] = useState(false)
  const isLogin = mode === 'login'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit()
  }

  return (
    <div className="auth-root">
      {/* 背景装饰 */}
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-circle auth-bg-circle--1" />
        <div className="auth-bg-circle auth-bg-circle--2" />
      </div>

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <MapPin size={28} strokeWidth={2.5} />
          </div>
          <h1 className="auth-title">POI 随手记</h1>
          <p className="auth-subtitle">随手记录每一个值得铭记的地方</p>
        </div>

        {/* 模式切换 Tab */}
        <div className="auth-tab-group" role="tablist">
          <button
            id="tab-login"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab ${isLogin ? 'auth-tab--active' : ''}`}
            onClick={() => onSetMode('login')}
          >
            登录
          </button>
          <button
            id="tab-register"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab ${!isLogin ? 'auth-tab--active' : ''}`}
            onClick={() => onSetMode('register')}
          >
            注册
          </button>
          {/* 滑动指示线 */}
          <div
            className="auth-tab-indicator"
            style={{ transform: `translateX(${isLogin ? '0' : '100%'})` }}
          />
        </div>

        {/* 表单 */}
        <div className="auth-form">
          <div className="auth-field">
            <label htmlFor="auth-email" className="auth-label">邮箱</label>
            <input
              id="auth-email"
              type="email"
              className="auth-input"
              placeholder="your@email.com"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password" className="auth-label">密码</label>
            <div className="auth-input-wrap">
              <input
                id="auth-password"
                type={showPwd ? 'text' : 'password'}
                className="auth-input auth-input--password"
                placeholder={isLogin ? '请输入密码' : '至少 6 位'}
                value={password}
                onChange={e => onPasswordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                disabled={isSubmitting}
              />
              <button
                id="btn-toggle-password"
                type="button"
                className="auth-eye-btn"
                aria-label={showPwd ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPwd(p => !p)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* 错误 / 消息提示 */}
          {error && (
            <p
              className={`auth-message ${error.startsWith('✅') ? 'auth-message--success' : 'auth-message--error'}`}
              role="alert"
            >
              {error}
            </p>
          )}

          {/* 提交按钮 */}
          <button
            id="btn-auth-submit"
            className="auth-submit-btn"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <Loader2 size={18} className="auth-spin" />
              : (isLogin ? '登录' : '创建账号')
            }
          </button>
        </div>

        {/* 底部切换 */}
        <p className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button
            id="btn-auth-switch"
            className="auth-switch-link"
            onClick={() => onSetMode(isLogin ? 'register' : 'login')}
          >
            {isLogin ? '立即注册' : '前往登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
