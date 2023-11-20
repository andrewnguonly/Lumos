import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Box, IconButton, LinearProgress, TextField } from "@mui/material";
import "./ChatBar.css";


const ChatBar: React.FC = () => {

  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const completionTextFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const handlePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
    chrome.storage.session.set({ prompt: event.target.value});
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
    var textContent = doc.body.textContent || "";

    // Use a regular expression to replace contiguous white spaces with a single space
    textContent = textContent.replace(/\s+/g, " ");

    return textContent.trim();
}

  const handleSendButtonClick = async () => {
    setLoading(true);
    setSubmitDisabled(true);
    setCompletion("");
    chrome.storage.session.set({ completion: "" });

    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      var activeTab = tabs[0];
      var activeTabId = activeTab.id;

      return chrome.scripting.executeScript({
        // @ts-ignore
        target: { tabId: activeTabId },
        injectImmediately: true,
        func: htmlToString,
        args: ["body"]
      });
    }).then(async (results) => {
      const pageContent = results[0].result;
      chrome.runtime.sendMessage({ context: pageContent }).then((_response) => {
        chrome.runtime.sendMessage({ prompt: prompt });
      });
    }).catch((error) => {
      console.log(`Error: ${error}`);
    });
  };

  const handleBackgroundMessage = ((msg: any, error: any) => {
    if (msg.answer) {
      setLoading(false);
      setSubmitDisabled(false);
      setCompletion(msg.answer);
      chrome.storage.session.set({ completion: msg.answer });
      if (completionTextFieldRef.current) {
        completionTextFieldRef.current.scrollTop = completionTextFieldRef.current.scrollHeight;
      }
    }
  });

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    
    chrome.storage.session.get(["prompt", "completion"], (data) => {
      if (data.prompt) {
        setPrompt(data.prompt);
      }
      if (data.completion) {
        setCompletion(data.completion);
      }
    });
  });

  return (
    <Box>
      <Box className="chat-bar">
        <TextField
          className="input-field"
          placeholder="Enter your prompt here"
          value={prompt}
          onChange={handlePromptChange}
          onKeyUp={(event) => {
            if (event.key === "Enter") {
              handleSendButtonClick();
            }
          }}
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
          inputRef={completionTextFieldRef}
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
