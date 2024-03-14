/**
 * @jest-environment jsdom
 */
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ThemeProvider, useThemeContext } from "../ThemeContext";

const MockComponent = () => {
  const { theme, toggleDarkMode } = useThemeContext();
  return (
    <div>
      <span>Current Theme: {theme.palette.mode}</span>
      <button onClick={toggleDarkMode}>Toggle Theme</button>
    </div>
  );
};

describe("ThemeProvider", () => {
  it("toggles the theme from light to dark and back", async () => {
    const mockGet = jest.fn().mockResolvedValue({ darkModeEnabled: false });
    const mockSet = jest.fn();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    global.chrome = {
      storage: {
        local: {
          get: mockGet,
          set: mockSet,
        },
      },
    } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const { findByText } = render(
      <ThemeProvider>
        <MockComponent />
      </ThemeProvider>,
    );

    expect(await findByText(/Current Theme: light/i)).toBeInTheDocument();

    const toggleButton = await findByText("Toggle Theme");
    await act(async () => userEvent.click(toggleButton));

    expect(await findByText(/Current Theme: dark/i)).toBeInTheDocument();

    await act(async () => userEvent.click(toggleButton));

    expect(await findByText(/Current Theme: light/i)).toBeInTheDocument();
  });
});
