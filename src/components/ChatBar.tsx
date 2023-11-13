import { Box, IconButton, LinearProgress, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import "./ChatBar.css";
import { useState } from "react";


const ChatBar: React.FC = () => {

  const [loading, setLoading] = useState(false);

  const handleSendButtonClick = async () => {
    setLoading(true);

    
  };

  return (
    <Box>
      <Box className="chat-bar">
        <TextField className="input-field" placeholder="Ask your question here"/>
        <IconButton className="submit-button" onClick={handleSendButtonClick}>
          <SendIcon/>
        </IconButton>
      </Box>
      <Box className="chat-box">
        <TextField className="chat-display-field" multiline rows={5}/>
      </Box>
      {loading && <LinearProgress/>}
    </Box>
  );
}

export default ChatBar;
