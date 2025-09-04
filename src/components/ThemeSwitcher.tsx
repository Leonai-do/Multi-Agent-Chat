/**
 * @file Renders a theme switching component with a dropdown menu.
 */
import React, { useState, useEffect, useRef, FC, ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { logEvent } from '../state/logs';
import type { Theme } from '../types';

/**
 * A UI component that allows the user to switch between light, dark, and system themes.
 *
 * @returns {React.ReactElement} The rendered theme switcher component.
 */
const ThemeSwitcher: FC = () => {
  // Hook to manage theme state
  const [currentTheme, setTheme] = useTheme();
  // State to manage dropdown visibility
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Defines the available themes with their properties
  const themes: { id: Theme, name: string, icon: ReactNode }[] = [
    { id: 'light', name: 'Light', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L5.64 5.64zm12.73 12.73c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06zM5.64 18.36c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06zm12.73-12.73c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06z"/></svg> },
    { id: 'dark', name: 'Dark', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.4-.31-.3-.39-.55-.83-.73-1.31-.36-.98-.3-2.1.16-3.04.48-.98 1.39-1.66 2.47-1.92.23-.05.47-.07.7-.07.03 0 .06 0 .09.01.28.01.55.05.81.12.01 0 .03-.01.04-.01.25.07.5.16.73.27.02 0 .03-.01.05-.01.23.11.45.24.66.38.1.07.21.13.31.21.01 0 .01 0 .02.01.02 0 .03.01.05.02.01 0 .02.01.04.01.01 0 .02.01.03.01.03.01.05.02.08.04.18.1.36.22.52.34.02.01.03.02.05.03.09.06.17.13.25.2.02.02.04.03.06.05.17.13.34.28.49.44.02.02.03.03.05.05.08.09.16.18.24.27l.02.02c.02.03.04.05.06.08.07.09.14.19.2.28.02.03.03.05.05.08.06.09.12.19.17.29.01.03.02.05.04.08.05.1.09.2.13.3.01.03.02.05.03.08.04.1.08.21.11.31.01.03.02.06.03.09.03.11.06.22.08.33.01.03.01.06.02.09.02.11.04.22.05.33.01.03.01.06.02.09.01.11.02.22.02.34 0 .22-.02.44-.05.65-.02.12-.05.24-.08.35-.01.03-.02.06-.03.09-.03.12-.07.24-.11.36-.01.03-.02.06-.04.09-.04.12-.09.23-.14.34-.01.03-.02.06-.04.09-.05.12-.11.23-.17.34-.01.03-.02.06-.04.09-.06.12-.13.23-.2.34-.01.03-.02.06-.04.09-.07.12-.15.23-.22.34-.01.03-.02.06-.04.09-.08.12-.16.23-.25.34-.01.03-.02.06-.04.09-.09.12-.18.23-.28.34-.01.03-.02.06-.04.09-.1.12-.2.23-.31.34A9.01 9.01 0 0112 21z"/></svg>},
    { id: 'system', name: 'System', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 4h16v2H4zm0 4h16v2H4z"/></svg> },
  ];

  // Effect to close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="theme-switcher" ref={dropdownRef}>
      <button className="theme-switcher__button" onClick={() => { const next = !isOpen; try { logEvent('ui','info','theme_dropdown',{ open: next }); } catch {}; setIsOpen(next); }} aria-label="Select theme">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.64-.11 2.4-.31-.3-.39-.55-.83-.73-1.31-.36-.98-.3-2.1.16-3.04.48-.98 1.39-1.66 2.47-1.92.23-.05.47-.07.7-.07.03 0 .06 0 .09.01.28.01.55.05.81.12.01 0 .03-.01.04-.01.25.07.5.16.73.27.02 0 .03-.01.05-.01.23.11.45.24.66.38.1.07.21.13.31.21.01 0 .01 0 .02.01.02 0 .03.01.05.02.01 0 .02.01.04.01.01 0 .02.01.03.01.03.01.05.02.08.04.18.1.36.22.52.34.02.01.03.02.05.03.09.06.17.13.25.2.02.02.04.03.06.05.17.13.34.28.49.44.02.02.03.03.05.05.08.09.16.18.24.27l.02.02c.02.03.04.05.06.08.07.09.14.19.2.28.02.03.03.05.05.08.06.09.12.19.17.29.01.03.02.05.04.08.05.1.09.2.13.3.01.03.02.05.03.08.04.1.08.21.11.31.01.03.02.06.03.09.03.11.06.22.08.33.01.03.01.06.02.09.02.11.04.22.05.33.01.03.01.06.02.09.01.11.02.22.02.34 0 .22-.02.44-.05.65-.02.12-.05.24-.08.35-.01.03-.02.06-.03.09-.03.12-.07.24-.11.36-.01.03-.02.06-.04.09-.04.12-.09.23-.14.34-.01.03-.02.06-.04.09-.05.12-.11.23-.17.34-.01.03-.02.06-.04.09-.06.12-.13.23-.2.34-.01.03-.02.06-.04.09-.07.12-.15.23-.22.34-.01.03-.02.06-.04.09-.08.12-.16.23-.25.34-.01.03-.02.06-.04.09-.09.12-.18.23-.28.34-.01.03-.02.06-.04.09-.1.12-.2.23-.31.34A9.01 9.01 0 0112 21z"/></svg>
      </button>
      {isOpen && (
        <div className="theme-switcher__dropdown">
          {themes.map(t => (
            <button key={t.id} className={`theme-item ${currentTheme === t.id ? 'theme-item--active' : ''}`} onClick={() => { try { logEvent('ui','info','theme_change',{ from: currentTheme, to: t.id }); } catch {}; setTheme(t.id); setIsOpen(false); }}>
              {t.icon}<span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
