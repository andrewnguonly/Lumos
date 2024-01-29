import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Alert, Box, IconButton, Snackbar, TextField, Tooltip } from "@mui/material";
import { Avatar, ChatContainer, Message, MessageList, TypingIndicator } from "@chatscope/chat-ui-kit-react";
import { DEFAULT_CONTENT_CONFIG } from "../pages/Options";
import { ContentConfig } from "../contentConfig";
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import "./ChatBar.css";


class LumosMessage {
  constructor(public sender: string, public message: string) {}
}

const ChatBar: React.FC = () => {

  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [messages, setMessages] = useState<LumosMessage[]>([]);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading1, setLoading1] = useState(false); // loading state during embedding process
  const [loading2, setLoading2] = useState(false); // loading state during completion process
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const textFieldRef = useRef<HTMLInputElement | null>(null);

  const handlePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
    chrome.storage.session.set({ prompt: event.target.value});
  };

  const getDomain = (hostname: string): string => {
    const parts = hostname.split(".");
    if (parts.length > 2) {
      return parts.slice(-2).join(".");
    } else {
      return hostname;
    }
  };

  const getHighlightedContent = (): string => {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : "";
  };

  const getHtmlContent = (selectors: string[], selectorsAll: string[]): string => {

    // if any content is highlighted, return the highlighted content
    const highlightedContent = getHighlightedContent();
    if (highlightedContent !== "") {
      return highlightedContent;
    } 

    // otherwise, return content from selected elements
    const parser = new DOMParser();
    var content = "";
    const elements: Element[] = [];

    // process selector queries
    if (selectors.length > 0) {
      for (const selector of selectors) {
        const selectedElement = document.querySelector(selector);
        if (selectedElement !== null) {
          elements.push(selectedElement);
        }
      }
    }

    // process selectorAll queries
    if (selectorsAll.length > 0) {
      for (const selectorAll of selectorsAll) {
        const selectedElements = document.querySelectorAll(selectorAll);
        for (let i = 0; i < selectedElements.length; i++) {
          elements.push(selectedElements[i]);
        }
      }
    }

    // retrieve content from selected elements
    for (const element of elements) {
      const doc = parser.parseFromString(element.outerHTML, "text/html");
      var textContent = doc.body.innerText || "";

      // Use a regular expression to replace contiguous white spaces with a single space
      textContent = textContent.replace(/\s+/g, " ").trim();

      // append textContent to overall content
      content += textContent + "\n";
    }

    return content;
  };

  const handleSendButtonClick = async () => {
    setLoading1(true);
    setSubmitDisabled(true);
    setCompletion("");

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    setMessages(newMessages);

    // get default content config
    const contentConfig: ContentConfig = await new Promise((resolve, reject) => {
      chrome.storage.local.get(["selectedConfig"], (data) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(JSON.parse(data.selectedConfig || DEFAULT_CONTENT_CONFIG) as ContentConfig);
        }
      });
    });
    var config = contentConfig["default"];

    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      const activeTabId = activeTab.id;
      const activeTabUrl = new URL(activeTab.url || "");
      const domain = getDomain(activeTabUrl.hostname);

      // get domain specific content config
      config = domain in contentConfig ? contentConfig[domain] : config;

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
        chrome.runtime.sendMessage({
          prompt: prompt,
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
        });

        // clear prompt after sending it to the background script
        setPrompt("");
        chrome.storage.session.set({ prompt: "" });
      });
    }).catch((error) => {
      console.log(`Error: ${error}`);
    });
  };

  const handleAvatarClick = (message: string) => {
    navigator.clipboard.writeText(message);
    setShowSnackbar(true);
    setSnackbarMessage("Copied!");
  }

  const handleClearButtonClick = () => {
    setMessages([]);
    chrome.storage.session.set({ messages: [] });
  };

  const handleBackgroundMessage = ((msg: any, error: any) => {
    if (msg.chunk) {
      setLoading1(false);
      setLoading2(true);

      // save new completion value
      const newCompletion = completion + msg.chunk;
      setCompletion(newCompletion);

      const lastMessage = messages[messages.length - 1];
      if (lastMessage !== undefined && lastMessage.sender === "user") {
        // append assistant message to messages list
        const newAssistantMsg = new LumosMessage("assistant", newCompletion);
        setMessages([...messages, newAssistantMsg]);
      } else {
        // replace last assistant message with updated message
        const newAssistantMsg = new LumosMessage("assistant", newCompletion);
        setMessages([...messages.slice(0, messages.length - 1), newAssistantMsg]);
      }
    } else if (msg.done) {
      // save messages after response streaming is done
      chrome.storage.session.set({ messages: messages });
      setLoading2(false);
      setSubmitDisabled(false);
    }
  });

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  });

  useEffect(() => {
    chrome.storage.session.get(["prompt", "messages"], (data) => {
      if (data.prompt) {
        setPrompt(data.prompt);
      }
      if (data.messages) {
        setMessages(data.messages);
      }
    });
  }, []);

  useEffect(() => {
    if (!submitDisabled && textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, [submitDisabled]);

  return (
    <Box>
      <div className="chat-container">
        <Snackbar
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          open={showSnackbar}
          autoHideDuration={1500}
          onClose={() => setShowSnackbar(false)}
        >
          <Alert onClose={() => setShowSnackbar(false)} severity="success" sx={{ width: "100%" }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
        <ChatContainer>
          <MessageList
            typingIndicator={
              loading1
                ? <TypingIndicator content="Lumos..." />
                : (loading2
                  ? <TypingIndicator content="Nox!" />
                  : null)
            }
          >
            {messages.map((message, index) => (
              <Message
                model={{
                  message: message.message,
                  sender: message.sender,
                  direction: message.sender === "user" ? "outgoing" : "incoming",
                  position: "single",
                }}
              >
                {<Avatar
                  src={message.sender === "user" ? "../assets/glasses_48.png" : "../assets/wand_48.png"}
                  onClick={() => handleAvatarClick(message.message)}
                />}
              </Message>  
            ))}
          </MessageList>
        </ChatContainer>
      </div>
      <Box className="chat-bar">
        <TextField
          className="input-field"
          placeholder="Enter your prompt here"
          value={prompt}
          disabled={submitDisabled}
          onChange={handlePromptChange}
          inputRef={textFieldRef}
          onKeyUp={(event) => {
            if (event.key === "Enter") {
              handleSendButtonClick();
            }
          }}
        />
        <IconButton
          className="submit-button"
          disabled={submitDisabled || prompt === ""}
          onClick={handleSendButtonClick}
        >
          <img alt="" src="../assets/wand_32.png" />
        </IconButton>
        <Tooltip title="Clear messages">
          <IconButton
            className="clear-button"
            disabled={submitDisabled}
            onClick={handleClearButtonClick}
          >
            <img alt="Clear messages" src="../assets/hat_32.png" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default ChatBar;
