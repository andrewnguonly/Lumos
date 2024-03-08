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
  loadChat: (chatId: number) => void;
}

const formatTs = (ts: string): string => {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const date = new Date(parseInt(ts));
  const dayOfWeek = daysOfWeek[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${dayOfWeek}, ${month} ${day}, ${year}`;
};

const ChatHistory: React.FC<ChatHistoryProps> = (props) => {
  const [chatHistory, setChatHistory] = useState<
    Record<number, Record<string, string>>
  >({});

  const handleMessagePreviewClick = (chatId: string) => {
    props.loadChat(parseInt(chatId));
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
        {Object.entries(chatHistory)
          .sort(([key1], [key2]) => key2.localeCompare(key1))
          .map(([chatId, chatMetadata]) => (
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
                  secondary={formatTs(chatId)}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ fontSize: 10 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </Box>
  );
};

ChatHistory.propTypes = {
  loadChat: PropTypes.func.isRequired,
};

export default ChatHistory;
