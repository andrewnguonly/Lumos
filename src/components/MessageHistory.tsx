import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";

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

  useEffect(() => {
    chrome.storage.local.get(["messageHistory"], (data) => {
      if (data.messageHistory) {
        setMessagePreviews(data.messageHistory.keys());
      }
    });
  }, []);

  return (
    <Box sx={{ width: 250 }} role="presentation">
      <List>
        {messagePreviews.map((text) => (
          <ListItem key={text} disablePadding>
            <ListItemButton onClick={() => handleMessagePreviewClick(text)}>
              <ListItemText primary={text} />
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
