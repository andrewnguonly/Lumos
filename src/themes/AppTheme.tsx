import { createTheme } from "@mui/material/styles";
import { amber } from '@mui/material/colors';

const AppTheme = createTheme({
  palette: {
    primary: amber,
  },
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
    },
  }
});

export default AppTheme;
