import React from 'react';
import { useTranslation } from 'react-i18next';

const Header = ({ isLoggedIn, user }) => {
  const { t } = useTranslation();

  return (
    <header className="app-header">
      <div className="logo">MyApp</div>
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
      <div className="user-actions">
        {isLoggedIn ? (
          <>
            <span>Welcome, {user.name}</span>
            <button className="btn-link">{t('auth.logout')}</button>
            <button className="btn-icon">{t('common.edit')}</button>
          </>
        ) : (
          <>
            <button className="btn-primary">{t('auth.login')}</button>
            <button className="btn-secondary">{t('auth.register')}</button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header; 