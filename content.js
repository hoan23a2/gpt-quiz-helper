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
      const optionElems = container.querySelectorAll(".answer_text");

      if (!questionElem || optionElems.length !== 4) {
        console.warn(`Skipping question ${idx + 1}: Missing question or not 4 options`);
        continue;
      }

      const question = questionElem.innerText.trim();
      const options = Array.from(optionElems).map(el => el.innerText.trim());

      questions.push({
        index: idx,
        question,
        options,
        elements: optionElems
      });

      // In ra câu hỏi và đáp án
      console.log(`Câu ${idx + 1}:`, question);
      console.log("Đáp án:");
      options.forEach((ans, i) => console.log(`${String.fromCharCode(65 + i)}. ${ans}`));
    }

    if (questions.length === 0) {
      showMessage("No valid questions found!", true);
      return;
    }

    // Tạo prompt cho tất cả câu hỏi
    const prompt = questions.map((q, idx) => {
      return `Question ${idx + 1}: ${q.question}\nOptions:\n${q.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}`;
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
    const responseText = await res.text();
    console.log("Raw response:", responseText);

    if (!res.ok) {
      if (res.status === 429) {
        showMessage("Rate limit exceeded! Please wait a few minutes before trying again.", true);
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
      const questionIndex = parseInt(num) - 1;
      const optionIndex = letter.toUpperCase().charCodeAt(0) - 65;
      
      if (questionIndex >= 0 && questionIndex < questions.length) {
        const question = questions[questionIndex];
        if (optionIndex >= 0 && optionIndex < 4) {
          question.elements[optionIndex].innerText += ".";
          console.log(`Correct answer for question ${num}: ${letter}`);
        }
      }
    });

    showMessage(`Processed ${answers.length} questions successfully!`);
  } catch (error) {
    console.error("Error:", error);
    showMessage(`Error: ${error.message}`, true);
  }
})();
