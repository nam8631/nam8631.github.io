// Chuyển phím tắt (chrome://extensions/shortcuts) tới content script của tab đang mở.
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: command }).catch(() => {});
});
