import { createTheme } from "@mui/material/styles";

const AppTheme = createTheme({
  components: {
    MuiTextField: {
      defaultProps: {
        size: "small"
      }
    },
    MuiIconButton: {
      defaultProps: {
        color: "primary"
      }
    }
  }
});

export default AppTheme;
