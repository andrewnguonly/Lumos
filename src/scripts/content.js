/*global chrome*/

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    port.postMessage({contents: document.body.innerHTML});
  });
});
