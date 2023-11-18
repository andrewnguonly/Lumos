import {ChatRestModule} from "@mlc-ai/web-llm";
import { Buffer } from 'buffer';

// TODO: Surface this as an option to the user 
const useWebGPU = false;

var cm: ChatRestModule;
if (!useWebGPU) {
    cm = new ChatRestModule();
}

// Set reponse callback for chat module
const generateProgressCallback = (_step: number, message: string) => {
    // send the answer back to the content script
    console.log(`generating progres... ${_step}`);
    console.log(`messsage: ${message}`);
    chrome.runtime.sendMessage({ answer: message });
};

var context = "";
chrome.runtime.onMessage.addListener(async function (request) {
    // check if the request contains a message that the user sent a new message
    if (request.prompt) {
        var inp = request.prompt;
        if (context.length > 0) {
            inp = "Use only the following context when answering the question at the end. Don't use any other knowledge.\n"+ context + "\n\nQuestion: " + request.input + "\n\nHelpful Answer: ";
        }
        console.log("Input:", inp);
        await cm.generate(inp, generateProgressCallback)
          .then((response) => {
            console.log(`got response: ${response}`);
          })
          .catch((error) => {
            console.log(`error: ${error}`);
          });
    }
    if (request.context) {
        context = request.context;
        console.log("Got context:", context);
    }
});
