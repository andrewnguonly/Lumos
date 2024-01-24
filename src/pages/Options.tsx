import { ThemeProvider } from "@mui/material";
import AppTheme from "../themes/AppTheme";


function Options() {
  return (
    <ThemeProvider theme={AppTheme}>
      <div>hello world!</div>
    </ThemeProvider>
  );
}

export default Options;
