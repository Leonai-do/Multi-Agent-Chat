/**
 * @file This file defines the `useTheme` custom hook for managing the application's theme.
 */

import { useState, useEffect } from 'react';
import type { Theme } from '../types';

/**
 * A custom hook to manage the application's theme (light, dark, or system).
 * It persists the theme choice to localStorage and applies it to the document.
 * It also listens for changes in the system's preferred color scheme.
 *
 * @returns A tuple containing:
 *  - `theme`: The current theme ('light', 'dark', or 'system').
 *  - `setTheme`: A function to update the theme.
 */
export const useTheme = (): [Theme, (theme: Theme) => void] => {
  /**
   * State to hold the current theme preference.
   * It initializes from localStorage or defaults to 'system'.
   */
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    return savedTheme || 'system';
  });

  /**
   * Effect to apply the theme to the DOM and handle system theme changes.
   */
  useEffect(() => {
    /**
     * Applies the chosen theme to the document's root element.
     * If theme is 'system', it resolves to 'light' or 'dark' based on OS settings.
     * Also saves the user's preference (not the resolved value) to localStorage.
     * @param {Theme} t - The theme to apply.
     */
    const applyTheme = (t: Theme) => {
      const newTheme = t === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t;
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', t);
    };

    // Apply the theme when the component mounts or theme state changes
    applyTheme(theme);

    // Set up a listener for changes in the OS's color scheme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme(theme);
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup the listener when the component unmounts
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]); // Rerun this effect if the theme state changes
  
  return [theme, setThemeState];
};