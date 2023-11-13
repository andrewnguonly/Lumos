import { ThemeProvider } from "@mui/material";
import AppTheme from "./themes/AppTheme";
import Popup from "./pages/Popup";


function App() {
  return (
    <ThemeProvider theme={AppTheme}>
      <Popup/>
    </ThemeProvider>
  );
}

export default App;
