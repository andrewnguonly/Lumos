import React, { createContext, useContext, useState, useEffect } from "react";
import { Theme, ThemeProvider as MUIThemeProvider } from "@mui/material";
import getAppTheme from "../themes/AppTheme";

interface ThemeContextValue {
  theme: Theme;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["darkModeEnabled"]).then((data) => {
      if (data.darkModeEnabled !== undefined) {
        setIsDarkMode(data.darkModeEnabled);
      }
    });
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => {
      const newMode = !prevMode;
      chrome.storage.local.set({ darkModeEnabled: newMode });
      return newMode;
    });
  };

  const theme = getAppTheme(isDarkMode);

  return (
    <ThemeContext.Provider value={{ theme, toggleDarkMode }}>
      <MUIThemeProvider theme={theme}>{children}</MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
