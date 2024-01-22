import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Box, IconButton, LinearProgress, TextField } from "@mui/material";
import { ChatContainer, Message, MessageList } from "@chatscope/chat-ui-kit-react";
import { contentConfig } from "../contentConfig";
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
  const [loading, setLoading] = useState(false);
  const completionTextFieldRef = useRef<HTMLTextAreaElement | null>(null);

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

  const getHtmlContent = (selectors: string[], selectorsAll: string[]) => {

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
  }

  const handleSendButtonClick = async () => {
    setLoading(true);
    setSubmitDisabled(true);
    setCompletion("");

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    setMessages(newMessages);

    // get default content config
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
      });
    }).catch((error) => {
      console.log(`Error: ${error}`);
    });
  };

  const handleBackgroundMessage = ((msg: any, error: any) => {
    if (msg.chunk) {
      setLoading(false);
      setSubmitDisabled(false);

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

      if (completionTextFieldRef.current) {
        completionTextFieldRef.current.scrollTop = completionTextFieldRef.current.scrollHeight;
      }
    }
  });

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  });

  useEffect(() => {
    chrome.storage.session.get(["prompt"], (data) => {
      if (data.prompt) {
        setPrompt(data.prompt);
      }
    });
  }, []);

  return (
    <Box>
      <div className="chat-container">
        <ChatContainer>
          <MessageList>
            {messages.map((message, index) => (
              <Message
                model={{
                  message: message.message,
                  sender: message.sender,
                  direction: message.sender === "user" ? "outgoing" : "incoming",
                  position: "single",
                }}
              />
            ))}
          </MessageList>
        </ChatContainer>
      </div>
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
      {loading && <LinearProgress />}
    </Box>
  );
}

export default ChatBar;
