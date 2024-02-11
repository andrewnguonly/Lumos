import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControlLabel,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Avatar,
  ChatContainer,
  Message,
  MessageList,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import {
  CHAT_CONTAINER_HEIGHT_MAX,
  CHAT_CONTAINER_HEIGHT_MIN,
  DEFAULT_HOST,
  getLumosOptions,
} from "../pages/Options";
import { getHtmlContent } from "../scripts/content";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "./ChatBar.css";

class LumosMessage {
  constructor(
    public sender: string,
    public message: string,
  ) {}
}

const ChatBar: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState(false);
  const [promptPlaceholderText, setPromptPlaceholderText] = useState(
    "Enter your prompt here",
  );
  const [parsingDisabled, setParsingDisabled] = useState(false);
  const [completion, setCompletion] = useState("");
  const [messages, setMessages] = useState<LumosMessage[]>([]);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading1, setLoading1] = useState(false); // loading state during embedding process
  const [loading2, setLoading2] = useState(false); // loading state during completion process
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const textFieldRef = useRef<HTMLInputElement | null>(null);
  const [chatContainerHeight, setChatContainerHeight] = useState(300);
  const [selectedHost, setSelectedHost] = useState(DEFAULT_HOST);

  const handlePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
    chrome.storage.session.set({ prompt: event.target.value });
  };

  const handleParsingDisabledChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setParsingDisabled(event.target.checked);
    chrome.storage.session.set({ parsingDisabled: event.target.checked });
  };

  const handleChangetHeight = (pixels: number) => {
    let newChatContainerHeight = chatContainerHeight + pixels;

    // constrain height between CHAT_CONTAINER_HEIGHT_MIN and CHAT_CONTAINER_HEIGHT_MAX
    if (newChatContainerHeight > CHAT_CONTAINER_HEIGHT_MAX) {
      newChatContainerHeight = CHAT_CONTAINER_HEIGHT_MAX;
    } else if (newChatContainerHeight < CHAT_CONTAINER_HEIGHT_MIN) {
      newChatContainerHeight = CHAT_CONTAINER_HEIGHT_MIN;
    }

    setChatContainerHeight(newChatContainerHeight);
    chrome.storage.local.set({ chatContainerHeight: newChatContainerHeight });
  };

  const getDomain = (hostname: string): string => {
    const parts = hostname.split(".");
    if (parts.length > 2) {
      return parts.slice(-2).join(".");
    } else {
      return hostname;
    }
  };

  const promptWithContent = async () => {
    setLoading1(true);
    setSubmitDisabled(true);
    setCompletion("");

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    setMessages(newMessages);

    // get default options
    const options = await getLumosOptions();
    const contentConfig = options.contentConfig;
    let config = contentConfig["default"];
    let activeTabUrl: URL;

    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const activeTab = tabs[0];
        const activeTabId = activeTab.id || 0;
        activeTabUrl = new URL(activeTab.url || "");
        const domain = getDomain(activeTabUrl.hostname);

        // get domain specific content config
        config = domain in contentConfig ? contentConfig[domain] : config;

        if (activeTabUrl.protocol === "chrome:") {
          // skip script injection for chrome:// urls
          const result = new Array(1);
          result[0] = { result: [prompt, false, []] };
          return result;
        } else {
          return chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            injectImmediately: true,
            func: getHtmlContent,
            args: [config.selectors, config.selectorsAll],
          });
        }
      })
      .then(async (results) => {
        const pageContent = results[0].result[0];
        const isHighlightedContent = results[0].result[1];
        const imageURLs = results[0].result[2];

        chrome.runtime.sendMessage({ context: pageContent }).then(() => {
          chrome.runtime.sendMessage({
            prompt: prompt,
            skipRAG: false,
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap,
            url: activeTabUrl.toString(),
            skipCache: isHighlightedContent,
            imageURLs: imageURLs,
          });

          // clear prompt after sending it to the background script
          setPrompt("");
          chrome.storage.session.set({ prompt: "" });
        });
      })
      .catch((error) => {
        console.log(`Error: ${error}`);
      });
  };

  const promptWithoutContent = async () => {
    setLoading1(true);
    setSubmitDisabled(true);
    setCompletion("");

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    setMessages(newMessages);

    // send prompt to background script
    chrome.runtime.sendMessage({ prompt: prompt, skipRAG: true });

    // clear prompt after sending it to the background script
    setPrompt("");
    chrome.storage.session.set({ prompt: "" });
  };

  const handleSendButtonClick = async () => {
    if (parsingDisabled) {
      promptWithoutContent();
    } else {
      promptWithContent();
    }
  };

  const handleAvatarClick = (message: string) => {
    navigator.clipboard.writeText(message);
    setShowSnackbar(true);
    setSnackbarMessage("Copied!");
  };

  const handleClearButtonClick = () => {
    setMessages([]);
    chrome.storage.session.set({ messages: [] });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey && event.key === "k") {
      handleClearButtonClick();
    }
  };

  const handleBackgroundMessage = (msg: {
    chunk: string;
    sender: string;
    done: boolean;
  }) => {
    if (msg.chunk) {
      const sender = msg.sender;
      setLoading1(false);
      setLoading2(true);

      // save new completion value
      const newCompletion = completion + msg.chunk;
      setCompletion(newCompletion);

      const lastMessage = messages[messages.length - 1];
      if (lastMessage !== undefined && lastMessage.sender === "user") {
        // append assistant/tool message to messages list
        const newAssistantMsg = new LumosMessage(sender, newCompletion);
        setMessages([...messages, newAssistantMsg]);
      } else {
        // replace last assistant/tool message with updated message
        const newAssistantMsg = new LumosMessage(sender, newCompletion);
        setMessages([
          ...messages.slice(0, messages.length - 1),
          newAssistantMsg,
        ]);
      }
    } else if (msg.done) {
      // save messages after response streaming is done
      chrome.storage.session.set({ messages: messages });
      setLoading2(false);
      setSubmitDisabled(false);
    }
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    document.addEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    chrome.storage.local.get(
      ["chatContainerHeight", "selectedHost"],
      (data) => {
        if (data.chatContainerHeight) {
          setChatContainerHeight(data.chatContainerHeight);
        }
        if (data.selectedHost) {
          setSelectedHost(data.selectedHost);
        }
      },
    );

    chrome.storage.session.get(
      ["prompt", "parsingDisabled", "messages"],
      (data) => {
        if (data.prompt) {
          setPrompt(data.prompt);
        }
        if (data.parsingDisabled) {
          setParsingDisabled(data.parsingDisabled);
        }
        if (data.messages) {
          setMessages(data.messages);
        }
      },
    );
  }, []);

  // API connectivity check
  useEffect(() => {
    fetch(`${selectedHost}/api/tags`)
      .then((response) => {
        if (response.ok) {
          setPromptError(false);
          setPromptPlaceholderText("Enter your prompt here");
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        setPromptError(true);
        setPromptPlaceholderText(
          "Unable to connect to Ollama API. Check Ollama server.",
        );
      });
  }, [selectedHost]);

  useEffect(() => {
    if (!submitDisabled && textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, [submitDisabled]);

  return (
    <Box>
      <Box className="chat-container" sx={{ height: chatContainerHeight }}>
        <Snackbar
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          open={showSnackbar}
          autoHideDuration={1500}
          onClose={() => setShowSnackbar(false)}
        >
          <Alert
            onClose={() => setShowSnackbar(false)}
            severity="success"
            sx={{ width: "100%" }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
        <ChatContainer>
          <MessageList
            typingIndicator={
              loading1 ? (
                <TypingIndicator content="Lumos..." />
              ) : loading2 ? (
                <TypingIndicator content="Nox!" />
              ) : null
            }
          >
            {messages.map((message, index) => (
              <Message
                key={index}
                model={{
                  message: message.message.trim(),
                  sender: message.sender,
                  direction:
                    message.sender === "user" ? "outgoing" : "incoming",
                  position: "single",
                }}
              >
                {
                  <Avatar
                    src={
                      message.sender === "user"
                        ? "../assets/glasses_48.png"
                        : message.sender === "assistant"
                          ? "../assets/wand_48.png"
                          : "../assets/hammer_48.png"
                    }
                    onClick={() => handleAvatarClick(message.message)}
                  />
                }
              </Message>
            ))}
          </MessageList>
        </ChatContainer>
      </Box>
      <Box sx={{ display: "flex" }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={parsingDisabled}
              onChange={handleParsingDisabledChange}
            />
          }
          label={
            <Typography sx={{ color: "gray", fontSize: 12 }}>
              Disable content parsing
            </Typography>
          }
        />
        <div style={{ flex: 1 }}></div>
        <ButtonGroup variant="text">
          <Tooltip title="Increase window height" placement="top">
            <Button onClick={() => handleChangetHeight(50)}>
              <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>
                +
              </Typography>
            </Button>
          </Tooltip>
          <Tooltip title="Decrease window height" placement="top">
            <Button onClick={() => handleChangetHeight(-50)}>
              <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>
                -
              </Typography>
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>
      <Box className="chat-bar">
        <TextField
          className="input-field"
          placeholder={promptPlaceholderText}
          value={prompt}
          disabled={submitDisabled}
          error={promptError}
          onChange={handlePromptChange}
          inputRef={textFieldRef}
          onKeyUp={(event) => {
            if (event.key === "Enter") {
              handleSendButtonClick();
            }
          }}
          sx={{
            "& .MuiInputBase-root.Mui-error": {
              WebkitTextFillColor: "red",
            },
          }}
        />
        <IconButton
          className="submit-button"
          disabled={submitDisabled || prompt === ""}
          onClick={handleSendButtonClick}
        >
          <img alt="" src="../assets/wand_32.png" />
        </IconButton>
        <Tooltip title="Clear messages (cmd + k)">
          <IconButton
            className="clear-button"
            disabled={submitDisabled}
            onClick={handleClearButtonClick}
          >
            <img alt="Clear messages (cmd + k)" src="../assets/hat_32.png" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatBar;
