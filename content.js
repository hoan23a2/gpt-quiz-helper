(async () => {
  console.log("GPT Quiz Helper script started...");

  // Tìm tất cả khối câu hỏi hiện có
  const questionContainers = document.querySelectorAll(".question_holder");

  if (questionContainers.length === 0) {
    console.warn("No question containers found.");
    return;
  }

  // Hiển thị thông báo trên trang web
  const showMessage = (message, isError = false) => {
    const messageDiv = document.createElement('div');
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '10px';
    messageDiv.style.right = '10px';
    messageDiv.style.padding = '10px';
    messageDiv.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
    messageDiv.style.color = isError ? '#c62828' : '#2e7d32';
    messageDiv.style.borderRadius = '4px';
    messageDiv.style.zIndex = '9999';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  };

  try {
    const { apikey } = await chrome.storage.sync.get("apikey");
    if (!apikey) {
      showMessage("API Key not found! Please set it in the popup.", true);
      return;
    }
    console.log("API Key found:", apikey.substring(0, 5) + "...");

    // Gom tất cả câu hỏi và đáp án
    const questions = [];
    for (let idx = 0; idx < questionContainers.length; idx++) {
      const container = questionContainers[idx];
      const questionElem = container.querySelector(".question_text");
      const optionElems = container.querySelectorAll(".answer_text, .answer_label");
      const questionNumberElem = container.querySelector(".question_name");

      if (!questionElem || optionElems.length !== 4) {
        console.warn(`Skipping question ${idx + 1}: Missing question or not 4 options`);
        continue;
      }

      // Lấy số thứ tự câu hỏi
      let questionNumber = idx + 1;
      if (questionNumberElem) {
        const numberText = questionNumberElem.innerText.trim();
        const match = numberText.match(/Question\s+(\d+)/i);
        if (match) {
          questionNumber = parseInt(match[1]);
        }
      }

      const question = questionElem.innerText.trim();
      const options = Array.from(optionElems).map(el => el.innerText.trim());

      questions.push({
        index: idx,
        number: questionNumber,
        question,
        options,
        elements: optionElems,
        container: container
      });

      // In ra câu hỏi và đáp án
      console.log(`Câu ${questionNumber}:`, question);
      console.log("Đáp án:");
      options.forEach((ans, i) => console.log(`${String.fromCharCode(65 + i)}. ${ans}`));
    }

    if (questions.length === 0) {
      showMessage("No valid questions found!", true);
      return;
    }

    // Tạo prompt cho tất cả câu hỏi
    const prompt = questions.map((q) => {
      return `Question ${q.number}: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`;
    }).join("\n\n") + "\n\nFor each question, which is the correct answer? (Reply with the question number and letter, e.g. '1. A, 2. B, 3. C')";

    console.log("Sending request to OpenAI...");
    console.log("Request payload:", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const requestBody = {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apikey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    console.log("Response status:", res.status);
    console.log("Response headers:", {
      "x-ratelimit-limit-requests": res.headers.get("x-ratelimit-limit-requests"),
      "x-ratelimit-remaining-requests": res.headers.get("x-ratelimit-remaining-requests"),
      "x-ratelimit-limit-tokens": res.headers.get("x-ratelimit-limit-tokens"),
      "x-ratelimit-remaining-tokens": res.headers.get("x-ratelimit-remaining-tokens")
    });

    const responseText = await res.text();
    console.log("Raw response:", responseText);

    if (!res.ok) {
      if (res.status === 429) {
        const resetTime = res.headers.get("x-ratelimit-reset-requests");
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        showMessage(`Rate limit exceeded! Please wait until ${resetDate?.toLocaleTimeString() || 'a few minutes'} before trying again.`, true);
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}, response: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const reply = data.choices?.[0]?.message?.content || "";
    console.log("GPT Response:", reply);

    // Xử lý câu trả lời
    const answers = reply.match(/\d+\.\s*[A-D]/gi) || [];
    answers.forEach(answer => {
      const [num, letter] = answer.match(/(\d+)\.\s*([A-D])/i).slice(1);
      const questionNumber = parseInt(num);
      const optionIndex = letter.toUpperCase().charCodeAt(0) - 65;
      
      // Tìm câu hỏi có số thứ tự tương ứng
      const question = questions.find(q => q.number === questionNumber);
      if (question && optionIndex >= 0 && optionIndex < 4) {
        // Tìm lại phần tử đáp án từ container
        const answerElem = question.container.querySelectorAll(".answer_text, .answer_label")[optionIndex];
        if (answerElem) {
          answerElem.innerText += ".";
          console.log(`Correct answer for question ${questionNumber}: ${letter}`);
        }
      }
    });

    showMessage(`Processed ${answers.length} questions successfully!`);
  } catch (error) {
    console.error("Error:", error);
    showMessage(`Error: ${error.message}`, true);
  }
})();
