import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('eventra-theme', theme);
    } catch {
      // Switching still works when browser storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Context and its hook are intentionally colocated.
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
