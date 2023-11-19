import { ChatRestModule } from "@mlc-ai/web-llm";


const cm = new ChatRestModule();
var context = "";

// Set reponse callback for chat module
const generateProgressCallback = (step: number, message: string) => {
  // send the answer back to the content script
  console.log(`messsage (${step}): ${message}`);
  chrome.runtime.sendMessage({ answer: message });
};

chrome.runtime.onMessage.addListener(async function (request) {
  if (request.prompt) {
    var prompt = request.prompt;
    if (context.length > 0) {
      prompt = "Use only the following context when answering the question at the end. Don't use any other knowledge.\n" + context + "\n\nQuestion: " + request.prompt + "\n\nHelpful Answer: ";
    }
    console.log(`Prompt: ${prompt}`);
    await cm.generate(prompt, generateProgressCallback);
  }
  if (request.context) {
    context = request.context;
    console.log(`Received context: ${context}`);
  }
});
