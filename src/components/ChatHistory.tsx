import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface ChatHistoryProps {
  loadOldChat: (chatId: number) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = (props) => {
  const [chatHistory, setChatHistory] = useState<
    Record<number, Record<string, string>>
  >({});

  const handleMessagePreviewClick = (chatId: string) => {
    props.loadOldChat(parseInt(chatId));
  };

  const handleMessagePreviewDelete = (chatId: string) => {
    chrome.storage.local.get(["chatHistory"], (data) => {
      if (data.chatHistory) {
        const newChatHistory = data.chatHistory;
        delete newChatHistory[parseInt(chatId)];
        setChatHistory(newChatHistory);
        chrome.storage.local.set({ chatHistory: newChatHistory });
      }
    });
  };

  useEffect(() => {
    chrome.storage.local.get(["chatHistory"], (data) => {
      if (data.chatHistory) {
        setChatHistory(data.chatHistory);
      }
    });
  }, []);

  return (
    <Box sx={{ width: 300 }} role="presentation">
      <List sx={{ padding: 0 }}>
        <ListSubheader>Chat History</ListSubheader>
        {Object.entries(chatHistory).map(([chatId, chatMetadata]) => (
          <ListItem
            key={chatId}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                onClick={() => handleMessagePreviewDelete(chatId)}
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemButton onClick={() => handleMessagePreviewClick(chatId)}>
              <ListItemText
                primary={chatMetadata.preview}
                primaryTypographyProps={{ noWrap: true }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

ChatHistory.propTypes = {
  loadOldChat: PropTypes.func.isRequired,
};

export default ChatHistory;
