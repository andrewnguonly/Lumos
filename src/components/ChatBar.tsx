import { ChangeEvent, useEffect, useState } from "react";
import { Box, IconButton, LinearProgress, TextField } from "@mui/material";
import "./ChatBar.css";


const ChatBar: React.FC = () => {

  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const handleSendButtonClick = async () => {
    setLoading(true);
    setSubmitDisabled(true);
    chrome.runtime.sendMessage({ prompt: prompt });
  };

  const handleBackgroundMessage = ((msg: any, error: any) => {
    if (msg.answer) {
      setLoading(false);
      setSubmitDisabled(false);
      setCompletion(msg.answer);
    }
  });

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  });

  return (
    <Box>
      <Box className="chat-bar">
        <TextField
          className="input-field"
          placeholder="Enter your prompt here"
          value={prompt}
          onChange={handlePromptChange}
        />
        <IconButton
          className="submit-button"
          disabled={submitDisabled}
          onClick={handleSendButtonClick}
        >
          <img alt="" src="../assets/wand_32.png" />
        </IconButton>
      </Box>
      <Box className="chat-box">
        <TextField
          className="chat-display-field"
          multiline
          rows={5}
          value={completion}
        />
      </Box>
      {loading && <LinearProgress />}
    </Box>
  );
}

export default ChatBar;
