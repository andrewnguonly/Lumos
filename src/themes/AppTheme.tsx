import { amber, blue, lightGreen, purple } from "@mui/material/colors";
import { createTheme, Theme } from "@mui/material/styles";

const getAppTheme = (darkMode: boolean): Theme => {
  return createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: darkMode ? lightGreen : amber,
      secondary: {
        main: darkMode ? blue[800] : purple[300],
      },
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
