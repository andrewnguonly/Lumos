import { Box, IconButton, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import "./ChatBar.css";


const ChatBar: React.FC = () => {
  return (
    <Box className="chat-bar">
      <TextField className="input-field" placeholder="Type your message" />
      <IconButton className="submit-button">
        <SendIcon/>
      </IconButton>
    </Box>
  );
}

export default ChatBar;
