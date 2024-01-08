import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Box, IconButton, LinearProgress, TextField } from "@mui/material";
import { contentConfig } from "../contentConfig";
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

  const getHtmlContent = (selectors: string[], selectorsAll: string[]) => {

    const parser = new DOMParser();
    var content = ""; // append relevant content to `content`

    if (selectors.length > 0) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element !== null) {
          const doc = parser.parseFromString(element.outerHTML, "text/html");
          var textContent = doc.body.innerText || "";

          // Use a regular expression to replace contiguous white spaces with a single space
          textContent = textContent.replace(/\s+/g, " ").trim();

          // append textContent to overall content
          content += textContent + "\n";
        }
      }
    }

    if (selectorsAll.length > 0) {
      for (const selectorAll of selectorsAll) {
        const elements = document.querySelectorAll(selectorAll);
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          // Perform operations on each element
          const doc = parser.parseFromString(element.outerHTML, "text/html");
          textContent = doc.body.innerText || "";

          // Use a regular expression to replace contiguous white spaces with a single space
          textContent = textContent.replace(/\s+/g, " ").trim();

          // append textContent to overall content
          content += textContent + "\n";
        }
      }
    }

    return content;
  }

  const handleSendButtonClick = async () => {
    setLoading(true);
    setSubmitDisabled(true);
    setCompletion("");
    chrome.storage.session.set({ completion: "" });

    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      const activeTabId = activeTab.id;
      const activeTabUrl = new URL(activeTab.url || "");
      const domain = activeTabUrl.hostname;

      // get content config
      const config = domain in contentConfig ? contentConfig[domain] : contentConfig["default"];

      return chrome.scripting.executeScript({
        // @ts-ignore
        target: { tabId: activeTabId },
        injectImmediately: true,
        func: getHtmlContent,
        args: [config.selectors, config.selectorsAll],
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
