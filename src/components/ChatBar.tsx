import {
  ChangeEvent,
  ClipboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Avatar,
  ChatContainer,
  Message,
  MessageList,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import AttachmentIcon from "@mui/icons-material/Attachment";
import HistoryIcon from "@mui/icons-material/History";
import InfoIcon from "@mui/icons-material/Info";
import PlaylistRemoveIcon from "@mui/icons-material/PlaylistRemove";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Drawer,
  FormControlLabel,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Markdown from "markdown-to-jsx";
import { v4 as uuidv4 } from "uuid";

import { getContentConfig } from "../contentConfig";
import { useThemeContext } from "../contexts/ThemeContext";
import { getBase64Str, getExtension } from "../document_loaders/util";
import {
  CHAT_CONTAINER_HEIGHT_MAX,
  CHAT_CONTAINER_HEIGHT_MIN,
  DEFAULT_HOST,
  apiConnected,
  getLumosOptions,
  preloadModel,
} from "../pages/Options";
import { getHtmlContent } from "../scripts/content";

import ChatHistory from "./ChatHistory";
import { CodeBlock, PreBlock } from "./CodeBlock";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "./ChatBar.css";

const DEFAULT_PROMPT_PLACEHOLDER_TEXT = "Enter your prompt here";

export class LumosMessage {
  constructor(
    public sender: string,
    public message: string,
  ) {}
}

export interface Attachment {
  name: string;
  base64: string;
  lastModified: number;
}

const ChatBar: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState(false);
  const [promptPlaceholderText, setPromptPlaceholderText] = useState(
    DEFAULT_PROMPT_PLACEHOLDER_TEXT,
  );
  const [parsingDisabled, setParsingDisabled] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [messages, setMessages] = useState<LumosMessage[]>([]);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [loading1, setLoading1] = useState(false); // loading state during embedding process
  const [loading1Text, setLoading1Text] = useState("");
  const [loading2, setLoading2] = useState(false); // loading state during completion process
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const textFieldRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [chatContainerHeight, setChatContainerHeight] = useState(300);
  const [openChatHistory, setOpenChatHistory] = useState(false);
  const [currentChatId, setCurrentChatId] = useState("");

  const { theme } = useThemeContext();
  const isDarkMode = theme.palette.mode === "dark";

  const chatContainerStyle = {
    backgroundColor: theme.palette.background.paper,
  };

  const messageListStyle = {
    backgroundColor: theme.palette.background.paper,
  };

  const messageStyle = isDarkMode
    ? {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }
    : {};

  const imageStyle = {
    filter: isDarkMode ? "invert(1)" : "none",
  };

  const typingIndicatorStyle = {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  };

  const handlePromptChange = (event: ChangeEvent<HTMLInputElement>) => {
    savePrompt(event.target.value);
  };

  const handleParsingDisabledChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setParsingDisabled(event.target.checked);
    chrome.storage.session.set({ parsingDisabled: event.target.checked });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileUploaded = event.target.files?.[0];

    if (fileUploaded) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let base64 = reader.result as string;

        // Override base64 encoded string with content from document loaded
        // files. Loading files on the client side (as opposed to the background
        // script) is a workaround for using document loaders that require
        // DOM/browser APIs.
        const extensions = [".pdf"];
        const extension = getExtension(fileUploaded.name, true);
        if (extensions.includes(extension)) {
          base64 = await getBase64Str(fileUploaded);
        }

        const attachment: Attachment = {
          name: fileUploaded.name,
          base64: base64,
          lastModified: fileUploaded.lastModified,
        };

        setAttachment(attachment);
        chrome.storage.session.set({ attachment: attachment });
      };
      reader.readAsDataURL(fileUploaded);
    }
  };

  /**
   * Clipboard content is processed as an attachment.
   */
  const loadAttachmentFromClipboard = () => {
    // get text from clipboard
    navigator.clipboard.readText().then((text) => {
      if (text !== "") {
        // remove non-Latin1 characters, btoa() only accepts Latin1 characters
        // eslint-disable-next-line no-control-regex
        const latin1Text = text.replace(/[^\x00-\xFF]/g, "");
        const currentDate = Date.now();

        // set text as attachment
        const attachment: Attachment = {
          name: `__clipboard__${currentDate}`,
          base64: `data:text/plain;base64,${btoa(latin1Text)}`,
          lastModified: currentDate,
        };

        setAttachment(attachment);
        chrome.storage.session.set({ attachment: attachment });
      }
    });
  };

  const handleAttachmentDelete = () => {
    setAttachment(null);
    chrome.storage.session.remove(["attachment"]);
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

  const saveMessages = (messages: LumosMessage[]) => {
    setMessages(messages);
    chrome.storage.session.set({ messages: messages });
  };

  const savePrompt = (prompt: string) => {
    setPrompt(prompt);
    chrome.storage.session.set({ prompt: prompt });
  };

  const saveCurrentChatId = (chatId: string) => {
    setCurrentChatId(chatId);
    chrome.storage.session.set({ currentChatId: chatId });
  };

  const loadChat = (chatId: string) => {
    console.log(`Loading chat ID: ${chatId}`);
    chrome.storage.local.get(["chatHistory"], (data) => {
      if (data.chatHistory) {
        saveMessages(data.chatHistory[chatId].messages);
        saveCurrentChatId(chatId);
      }
      // close message history drawer
      setOpenChatHistory(false);
    });
  };

  const saveChat = () => {
    if (currentChatId !== "") {
      setShowSnackbar(true);
      setSnackbarMessage("Chat is already saved");
      return;
    }
    if (messages.length === 0) {
      // don't save an empty chat
      return;
    }

    setShowSnackbar(true);
    setSnackbarMessage("Saved chat!");
    let newChatHistory;

    // generate new chat ID
    const newChatId = uuidv4().substring(0, 8);
    console.log(`Creating new chat ID: ${newChatId}`);

    chrome.storage.local.get(["chatHistory"], (data) => {
      if (data.chatHistory) {
        // chat history already exists in local storage
        newChatHistory = data.chatHistory;
        // add new chat to chat history
        newChatHistory[newChatId] = {
          updatedAt: Date.now(),
          preview: messages[1].message.slice(0, 50),
          messages: messages,
        };
      } else {
        // create new chat history in local storage
        newChatHistory = {
          [newChatId]: {
            updatedAt: Date.now(),
            preview: messages[1].message.slice(0, 50),
            messages: messages,
          },
        };
      }

      // save new chat history in local storage and update current chat ID
      saveCurrentChatId(newChatId);
      chrome.storage.local.set({ chatHistory: newChatHistory });
    });
  };

  const updateChat = (chatId?: string) => {
    if (chatId) {
      chrome.storage.local.get(["chatHistory"], (data) => {
        if (data.chatHistory) {
          // chat history already exists in local storage
          const newChatHistory = data.chatHistory;
          // add new chat to chat history
          newChatHistory[chatId] = {
            updatedAt: Date.now(),
            preview: messages[0].message,
            messages: messages,
          };

          // save new chat history in local storage and update current chat ID
          saveCurrentChatId(chatId);
          chrome.storage.local.set({ chatHistory: newChatHistory });
        }
      });
    }
  };

  const setLoading = () => {
    setLoading1(true);
    setLoading1Text("Raise your wand...");
    setSubmitDisabled(true);
    setPromptPlaceholderText("Press ctrl + c to cancel the request");
  };

  const promptWithContent = async (prompt: string) => {
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

        if (activeTabUrl.protocol === "chrome:" || attachment) {
          // skip script injection for chrome:// urls or if an attachment is present
          const result = new Array(1);
          result[0] = { result: ["", false, []] };
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

        // if an attachment is present, the URL gets set to a fake file URL
        const attachments = [];
        let url = activeTabUrl.toString();
        if (attachment) {
          attachments.push(attachment);
          url = `file://${attachment.name}/${attachment.lastModified}`;
        }

        setHighlightedContent(isHighlightedContent);

        chrome.runtime
          .sendMessage({ context: pageContent, attachments: attachments })
          .then(() => {
            chrome.runtime.sendMessage({
              prompt: prompt,
              skipRAG: false,
              chunkSize: config.chunkSize,
              chunkOverlap: config.chunkOverlap,
              url: url,
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
    setLoading();

    // save user message to messages list
    const newMessages = [...messages, new LumosMessage("user", prompt)];
    saveMessages(newMessages);

    if (parsingDisabled) {
      chrome.runtime.sendMessage({ prompt: prompt, skipRAG: true });
    } else {
      promptWithContent(prompt);
    }

    // clear prompt after sending it to the background script
    savePrompt("");
  };

  const cancelRequest = () => {
    chrome.runtime.sendMessage({ cancelRequest: true });
  };

  const regenerate = () => {
    setLoading();

    // delete last message (assistant/tool message)
    const newMessages = messages.slice(0, messages.length - 1);
    saveMessages(newMessages);

    // get last message (user message)
    const lastUserPrompt = newMessages[newMessages.length - 1].message;

    if (parsingDisabled) {
      chrome.runtime.sendMessage({ prompt: lastUserPrompt, skipRAG: true });
    } else {
      promptWithContent(lastUserPrompt);
    }

    // clear prompt after sending it to the background script
    savePrompt("");
  };

  const handleAvatarClick = (message: string) => {
    navigator.clipboard.writeText(message);
    setShowSnackbar(true);
    setSnackbarMessage("Copied!");
  };

  const handleClearButtonClick = () => {
    saveMessages([]);
    saveCurrentChatId("");
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.altKey) {
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
          navigator.clipboard.writeText(
            messages[messages.length - 1].message.trim(),
          );
          setShowSnackbar(true);
          setSnackbarMessage("Copied!");
          break;
        case "b":
          // load clipboard text as attachment
          //
          // For security reasons, a user interaction is required to access
          // the clipboard.
          loadAttachmentFromClipboard();
          break;
        case ";":
          // open message history
          setOpenChatHistory(!openChatHistory);
          break;
        case "s":
          // save chat to chat history
          event.preventDefault();
          saveChat();
      }
    } else if (event.ctrlKey) {
      switch (event.key) {
        case "c":
          // cancel request
          cancelRequest();
          break;
        case "x":
          // remove attachment
          handleAttachmentDelete();
          break;
        case "r":
          // regenerate last LLM response
          regenerate();
          break;
      }
    }
  };

  /**
   * This function is needed to prevent HTML elements (e.g. background color)
   * from being copied to the clipboard. Only plain text should be copied to
   * the clipboard.
   */
  const handleMessageOnCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    const selectedText = window.getSelection()?.toString() || "";
    if (selectedText !== "") {
      navigator.clipboard.writeText(selectedText);
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
      setLoading1(false);
      setLoading2(false);
      setSubmitDisabled(false);
      updateChat(currentChatId);
      setPromptPlaceholderText(DEFAULT_PROMPT_PLACEHOLDER_TEXT);
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
      [
        "chatContainerHeight",
        "selectedModel",
        "selectedEmbeddingModel",
        "selectedHost",
        "chatHistory",
      ],
      async (data) => {
        if (data.chatContainerHeight) {
          setChatContainerHeight(data.chatContainerHeight);
        }
        if (data.chatHistory) {
          chrome.storage.session.get(["currentChatId"], (sessionData) => {
            if (
              sessionData.currentChatId &&
              data.chatHistory[sessionData.currentChatId]
            ) {
              // Only set the current chat ID if it's present in the chat history.
              // It may have been deleted in the chat history view.
              console.log(
                "Setting current chat id:",
                sessionData.currentChatId,
              );
              setCurrentChatId(sessionData.currentChatId);
            }
          });
        }

        // API connectivity check
        const selectedHost = data.selectedHost || DEFAULT_HOST;
        const [connected, models, errMsg] = await apiConnected(selectedHost);

        if (connected) {
          setPromptError(false);
          setPromptPlaceholderText(DEFAULT_PROMPT_PLACEHOLDER_TEXT);

          if (!data.selectedModel) {
            // persist selected model to local storage
            chrome.storage.local.set({ selectedModel: models[0] });
          }

          // preload inference model
          const inferenceModel = data.selectedModel || models[0];
          preloadModel(selectedHost, inferenceModel);

          // preload embedding model
          const embeddingModel = data.selectedEmbeddingModel || inferenceModel;
          if (embeddingModel !== inferenceModel) {
            preloadModel(selectedHost, embeddingModel, true);
          }
        } else {
          setPromptError(true);
          setPromptPlaceholderText(errMsg);
        }
      },
    );

    chrome.storage.session.get(
      ["prompt", "parsingDisabled", "messages", "attachment"],
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
              setPromptPlaceholderText(DEFAULT_PROMPT_PLACEHOLDER_TEXT);
              chrome.storage.sync.remove(["completion", "sender"]);
            }
          });
        }
        if (data.attachment) {
          setAttachment(data.attachment);
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
      <Drawer open={openChatHistory} onClose={() => setOpenChatHistory(false)}>
        <ChatHistory loadChat={loadChat} />
      </Drawer>
      <Box
        className="lumos-chat-container"
        sx={{ height: chatContainerHeight }}
      >
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
        <ChatContainer style={chatContainerStyle}>
          <MessageList
            style={messageListStyle}
            typingIndicator={
              (loading1 || loading2) && (
                <TypingIndicator
                  content={loading1 ? loading1Text : "Lumos!"}
                  style={typingIndicatorStyle}
                />
              )
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
                style={messageStyle}
                onCopy={handleMessageOnCopy}
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
                  style={imageStyle}
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
                  {message.sender === "assistant" &&
                    index === messages.length - 1 && (
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <div style={{ flex: 1 }}></div>
                        <IconButton
                          sx={{ padding: 0 }}
                          size="small"
                          color="secondary"
                          onClick={regenerate}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Box>
                    )}
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
              {`Disable ${attachment ? "file" : "content"} parsing`}
            </Typography>
          }
        />
        {highlightedContent && (
          <Tooltip title="Page has highlighted content" placement="top">
            <InfoIcon fontSize="small" color="primary" />
          </Tooltip>
        )}
        <div style={{ flex: 1 }}></div>
        {attachment && (
          <Tooltip
            placement="top"
            title={`Unattach ${attachment.name.startsWith("__clipboard__") ? "clipboard content" : attachment.name} (ctrl + x)`}
          >
            <IconButton
              disabled={submitDisabled}
              onClick={handleAttachmentDelete}
            >
              <PlaylistRemoveIcon />
            </IconButton>
          </Tooltip>
        )}
        <IconButton disabled={submitDisabled} onClick={saveChat}>
          <Tooltip
            placement="top"
            title="Save chat (cmd + s)"
          >
            <SaveAltIcon />
          </Tooltip>
        </IconButton>
        <IconButton
          disabled={submitDisabled}
          onClick={() => setOpenChatHistory(true)}
        >
          <Tooltip
            placement="top"
            title="Open chat history (cmd + ;)"
          >
            <HistoryIcon />
          </Tooltip>
        </IconButton>
        <ButtonGroup variant="text">
          <Tooltip
            placement="top"
            title="Increase chat window height"
          >
            <Button onClick={() => handleChangeHeight(50)}>
              <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>+</Typography>
            </Button>
          </Tooltip>
          <Tooltip
            placement="top"
            title="Decrease chat window height"
          >
            <Button onClick={() => handleChangeHeight(-50)}>
              <Typography sx={{ fontWeight: "bold", fontSize: 14 }}>-</Typography>
            </Button>
          </Tooltip>
          <Button
            onClick={() => {
              chrome.runtime.openOptionsPage();
            }}
          >
            <SettingsIcon sx={{ fontWeight: "bold", fontSize: 20 }} />
          </Button>
        </ButtonGroup>
      </Box>
      <Box className="lumos-chat-bar">
        <TextField
          className="lumos-input-field"
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
          InputProps={{
            startAdornment: (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAttachmentChange}
                  style={{ display: "none" }}
                />
                <IconButton
                  sx={{ p: "0 8px 0 0" }}
                  onClick={handleAttachmentClick}
                >
                  <AttachmentIcon />
                </IconButton>
              </div>
            ),
          }}
        />
        <IconButton
          className="lumos-submit-button"
          disabled={submitDisabled || prompt === ""}
          onClick={handleSendButtonClick}
          style={imageStyle}
        >
          <img alt="" src="../assets/wand_32.png" />
        </IconButton>
        <Tooltip title="Clear messages (cmd + k)">
          <IconButton
            className="lumos-clear-button"
            disabled={submitDisabled}
            onClick={handleClearButtonClick}
            style={imageStyle}
          >
            <img alt="Clear messages (cmd + k)" src="../assets/hat_32.png" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatBar;
