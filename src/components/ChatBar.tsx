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

  const htmlToString = (selector: any) => {
    if (selector) {
        selector = document.querySelector(selector);
        if (!selector) return ""
    } else {
        selector = document.documentElement;
    }

    // strip HTML tags
    const parser = new DOMParser();
    const doc = parser.parseFromString(selector.outerHTML, "text/html");
    const textContent = doc.body.textContent || "";

    return textContent.trim();
}

  const handleSendButtonClick = async () => {
    setLoading(true);
    setSubmitDisabled(true);
    chrome.runtime.sendMessage({ prompt: prompt });

    chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      var activeTab = tabs[0];
      var activeTabId = activeTab.id;

      return chrome.scripting.executeScript({
         // @ts-ignore
        target: { tabId: activeTabId },
        injectImmediately: true,
        func: htmlToString,
        args: ["body"]
      });
    }).then(function (results) {
      chrome.runtime.sendMessage({ context: results[0].result });
      chrome.runtime.sendMessage({ prompt: prompt });
    }).catch(function (error) {
      console.log(`Error injecting script: ${error}`);
    });
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
