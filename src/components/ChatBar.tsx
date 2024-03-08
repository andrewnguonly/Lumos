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
import InfoIcon from "@mui/icons-material/Info";
import {
  Avatar,
  ChatContainer,
  Message,
  MessageList,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import Markdown from "markdown-to-jsx";
import {
  CHAT_CONTAINER_HEIGHT_MAX,
  CHAT_CONTAINER_HEIGHT_MIN,
  DEFAULT_HOST,
  getLumosOptions,
} from "../pages/Options";
import { getHtmlContent } from "../scripts/content";
import { getContentConfig } from "../contentConfig";
import { CodeBlock, PreBlock } from "./CodeBlock";
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
  const [highlightedContent, setHighlightedContent] = useState(false);
  const [messages, setMessages] = useState<LumosMessage[]>([]);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading1, setLoading1] = useState(false); // loading state during embedding process
  const [loading1Text, setLoading1Text] = useState("");
  const [loading2, setLoading2] = useState(false); // loading state during completion process
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const textFieldRef = useRef<HTMLInputElement | null>(null);
  const [chatContainerHeight, setChatContainerHeight] = useState(300);

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

  const handleChangeHeight = (pixels: number) => {
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

  const promptWithContent = async () => {
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

        // get path specific content config
        config = getContentConfig(activeTabUrl, contentConfig) || config;

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

        setHighlightedContent(isHighlightedContent);

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
        });
      })
      .catch((error) => {
        console.log(`Error: ${error}`);
      });
  };

  const handleSendButtonClick = async () => {
    setLoading1(true);
    setLoading1Text("Raise your wand...");
    setSubmitDisabled(true);

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    setMessages(newMessages);
    chrome.storage.session.set({ messages: newMessages });

    if (parsingDisabled) {
      chrome.runtime.sendMessage({ prompt: prompt, skipRAG: true });
    } else {
      promptWithContent();
    }

    // clear prompt after sending it to the background script
    setPrompt("");
    chrome.storage.session.set({ prompt: "" });
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
    if (event.metaKey) {
      const toggledParsingDisabled = !parsingDisabled;

      switch (event.key) {
        case "k":
          // clear messages
          handleClearButtonClick();
          break;
        case "j":
          // toggle disable parsing checkbox
          setParsingDisabled(toggledParsingDisabled);
          chrome.storage.session.set({
            parsingDisabled: toggledParsingDisabled,
          });
          break;
        case "c":
          // copy last message
          if (messages.length === 0) return;
          navigator.clipboard.writeText(messages[messages.length - 1].message);
          setShowSnackbar(true);
          setSnackbarMessage("Copied!");
          break;
      }
    }
  };

  const appendNonUserMessage = (
    currentMessages: LumosMessage[],
    sender: string,
    completion: string,
  ): LumosMessage[] => {
    const newMsg = new LumosMessage(sender, completion);
    const lastMessage = currentMessages[currentMessages.length - 1];
    let newMessages;

    if (lastMessage !== undefined && lastMessage.sender === "user") {
      // append assistant/tool message to messages list
      newMessages = [...currentMessages, newMsg];
    } else {
      // replace last assistant/tool message with updated message
      newMessages = [
        ...currentMessages.slice(0, currentMessages.length - 1),
        newMsg,
      ];
    }

    setMessages(newMessages);
    return newMessages;
  };

  const handleBackgroundMessage = (msg: {
    docNo: number;
    docCount: number;
    skipCache: boolean;
    completion: string;
    sender: string;
    done: boolean;
  }) => {
    if (msg.docNo) {
      const skipCacheMsg = msg.skipCache ? " (skipping cache)" : "";
      setLoading1(true);
      setLoading1Text(
        `Generated embedding ${msg.docNo} of ${msg.docCount}${skipCacheMsg}`,
      );
    } else if (msg.completion) {
      setLoading1(false);
      setLoading2(true);
      appendNonUserMessage(messages, msg.sender, msg.completion);
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

    return () => {
      chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => {
    chrome.storage.local.get(
      ["chatContainerHeight", "selectedHost"],
      (data) => {
        if (data.chatContainerHeight) {
          setChatContainerHeight(data.chatContainerHeight);
        }

        // API connectivity check
        const selectedHost = data.selectedHost || DEFAULT_HOST;
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
          const currentMsgs = data.messages;
          setMessages(currentMsgs);

          // check if there is a completion in storage to append to the messages list
          chrome.storage.sync.get(["completion", "sender"], (data) => {
            if (data.completion && data.sender) {
              const newMessages = appendNonUserMessage(
                currentMsgs,
                data.sender,
                data.completion,
              );
              chrome.storage.session.set({ messages: newMessages });

              setLoading2(false);
              setSubmitDisabled(false);
              chrome.storage.sync.remove(["completion", "sender"]);
            }
          });
        }
      },
    );
  }, []);

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
                <TypingIndicator content={loading1Text} />
              ) : loading2 ? (
                <TypingIndicator content="Lumos!" />
              ) : null
            }
          >
            {messages.map((message, index) => (
              <Message
                key={index}
                model={{
                  sender: message.sender,
                  direction:
                    message.sender === "user" ? "outgoing" : "incoming",
                  position: "single",
                }}
                type="custom"
              >
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
                <Message.CustomContent>
                  <Markdown
                    options={{
                      overrides: {
                        pre: PreBlock,
                        code: CodeBlock,
                      },
                    }}
                  >
                    {message.message.trim()}
                  </Markdown>
                </Message.CustomContent>
              </Message>
            ))}
          </MessageList>
        </ChatContainer>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
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
        {highlightedContent && (
          <Tooltip title="Page has highlighted content" placement="top">
            <InfoIcon fontSize="small" color="primary" />
          </Tooltip>
        )}
        <div style={{ flex: 1 }}></div>
        <ButtonGroup variant="text">
          <Tooltip title="Increase window height" placement="top">
            <Button onClick={() => handleChangeHeight(50)}>
              <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>
                +
              </Typography>
            </Button>
          </Tooltip>
          <Tooltip title="Decrease window height" placement="top">
            <Button onClick={() => handleChangeHeight(-50)}>
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
          multiline
          maxRows={5}
          placeholder={promptPlaceholderText}
          value={prompt}
          disabled={submitDisabled}
          error={promptError}
          onChange={handlePromptChange}
          inputRef={textFieldRef}
          onKeyUp={(event) => {
            if (!event.shiftKey && event.key === "Enter") {
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
