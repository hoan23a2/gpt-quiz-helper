const apiKeyInput = document.getElementById('apikey');
const statusDiv = document.getElementById('status');

document.getElementById('save').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    statusDiv.style.color = 'red';
    statusDiv.textContent = 'API Key is required!';
    return;
  }
  chrome.storage.sync.set({ apikey: key }, () => {
    statusDiv.style.color = 'green';
    statusDiv.textContent = 'API Key saved!';
    apiKeyInput.value = '';
  });
});

document.getElementById('run').addEventListener('click', async () => {
  statusDiv.style.color = 'black';
  statusDiv.textContent = 'Running script...';

  // Lấy thông tin tab hiện tại
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Kiểm tra xem trang web có chứa câu hỏi không
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return document.querySelectorAll('.question_holder').length > 0;
    }
  }, async (results) => {
    if (chrome.runtime.lastError) {
      statusDiv.style.color = 'red';
      statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }

    const hasQuestions = results[0].result;
    if (!hasQuestions) {
      statusDiv.style.color = 'red';
      statusDiv.textContent = 'No quiz questions found on this page!';
      return;
    }

    // Nếu tìm thấy câu hỏi, chạy script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) {
        statusDiv.style.color = 'red';
        statusDiv.textContent = 'Error running script: ' + chrome.runtime.lastError.message;
      } else {
        statusDiv.style.color = 'green';
        statusDiv.textContent = 'Script executed!';
      }
    });
  });
});
