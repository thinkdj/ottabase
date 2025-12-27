import { useTheme } from "@/ottabase/hooks/useThemeManager";
import { IconMoonStars, IconSun } from "@tabler/icons-react";
import { useEffect, useState } from "react";

type DarkModeToggleProps = {
  type: "toggle-switch" | "button";
  title?: string;
};

/**
 * DarkModeToggle - TanStack-compatible theme toggle
 * 
 * This component uses the custom useTheme hook instead of next-themes,
 * making it compatible with non-Next.js frameworks like TanStack Start.
 */
const DarkModeToggle = (props: DarkModeToggleProps) => {
  const { type, title = "Toggle color scheme" } = props;
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoids hydration mismatch by ensuring the component only renders
  // on the client where the theme is known.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDarkMode = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  return type === "toggle-switch" ? (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isDarkMode ? "bg-gray-700" : "bg-gray-300"
      }`}
      title={title}
    >
      <span
        className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white transition-transform ${
          isDarkMode ? "translate-x-6" : "translate-x-1"
        }`}
      >
        {isDarkMode ? (
          <IconMoonStars size={14} stroke={2.5} />
        ) : (
          <IconSun size={14} stroke={2.5} />
        )}
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2"
      title={title}
    >
      {isDarkMode ? (
        <IconSun size={18} className="text-yellow-500" />
      ) : (
        <IconMoonStars size={18} className="text-gray-600 dark:text-gray-400" />
      )}
    </button>
  );
};

export default DarkModeToggle;
