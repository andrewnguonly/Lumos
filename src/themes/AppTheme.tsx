import { createTheme } from "@mui/material/styles";
import { amber } from "@mui/material/colors";

const AppTheme = createTheme({
  palette: {
    primary: amber,
  },
  components: {
    MuiCheckbox: {
      defaultProps: {
        size: "small",
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiIconButton: {
      defaultProps: {
        color: "primary",
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },
  },
});

export default AppTheme;
