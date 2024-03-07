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

interface MessageHistoryProps {
  loadOldMessages: (preview: string) => void;
}

const MessageHistory: React.FC<MessageHistoryProps> = (props) => {
  const [messagePreviews, setMessagePreviews] = useState([
    "a preview of chat history 1",
    "a preview of chat history 2",
    "a preview of chat history 3",
    "a preview of chat history 4",
    "a preview of chat history 5",
    "a preview of chat history 6",
    "a preview of chat history 7",
    "a preview of chat history 8",
    "a preview of chat history 9",
    "a preview of chat history 10",
    "a preview of chat history 11",
    "a preview of chat history 12",
  ]);

  const handleMessagePreviewClick = (text: string) => {
    props.loadOldMessages(text);
  };

  const handleMessagePreviewDelete = (text: string) => {
    chrome.storage.local.get(["messageHistory"], (data) => {
      if (data.messageHistory) {
        const newMessageHistory = data.messageHistory;
        delete newMessageHistory[text];
        setMessagePreviews(newMessageHistory.keys());
        chrome.storage.local.set({ messageHistory: newMessageHistory });
      }
    });
  };

  useEffect(() => {
    chrome.storage.local.get(["messageHistory"], (data) => {
      if (data.messageHistory) {
        setMessagePreviews(data.messageHistory.keys());
      }
    });
  }, []);

  return (
    <Box sx={{ width: 300 }} role="presentation">
      <List sx={{ padding: 0 }}>
        <ListSubheader>Chat History</ListSubheader>
        {messagePreviews.map((text) => (
          <ListItem
            key={text}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                onClick={() => handleMessagePreviewDelete(text)}
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemButton onClick={() => handleMessagePreviewClick(text)}>
              <ListItemText
                primary={text}
                primaryTypographyProps={{ noWrap: true }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

MessageHistory.propTypes = {
  loadOldMessages: PropTypes.func.isRequired,
};

export default MessageHistory;
