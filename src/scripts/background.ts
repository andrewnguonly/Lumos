import { ChatRestModule } from "@mlc-ai/web-llm";


// TODO: Surface this as an option to the user 
const useWebGPU = false;

var chatModule: ChatRestModule;
if (!useWebGPU) {
    chatModule = new ChatRestModule();
}

export {};
