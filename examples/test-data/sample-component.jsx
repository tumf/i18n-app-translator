import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LoginForm = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!email) {
      newErrors.email = t('errors.required');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('errors.invalidEmail');
    }

    if (!password) {
      newErrors.password = t('errors.required');
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('errors.passwordMismatch');
    }

    setErrors(newErrors);

    // Submit if no errors
    if (Object.keys(newErrors).length === 0) {
      // Submit form
    }
  };

  return (
    <div className="login-form">
      <h2>{t('auth.login')}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <div className="error">{errors.email}</div>}
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <div className="error">{errors.password}</div>}
        </div>

        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {errors.confirmPassword && <div className="error">{errors.confirmPassword}</div>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </div>

        <div className="form-footer">
          <a href="/forgot-password">{t('auth.forgotPassword')}</a>
          <a href="/register">{t('auth.register')}</a>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;