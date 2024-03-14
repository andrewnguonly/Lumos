import { createTheme, Theme } from "@mui/material/styles";
import { amber, lightGreen } from "@mui/material/colors";

const getAppTheme = (darkMode: boolean): Theme => {
  return createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: darkMode ? lightGreen : amber,
      text: {
        primary: darkMode ? "#aed581" : "#212121",
      },
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
