import { createTheme, Theme } from "@mui/material/styles";
import { amber, deepOrange } from "@mui/material/colors";

const getAppTheme = (darkMode: boolean): Theme => {
  return createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: darkMode ? deepOrange : amber,
    },
    components: {
      MuiButton: {
        defaultProps: {
          size: "small",
        },
      },
      MuiButtonGroup: {
        defaultProps: {
          size: "small",
        },
      },
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
      MuiSwitch: {
        defaultProps: {
          size: "small",
        },
      },
    },
  });
};
export default getAppTheme;
