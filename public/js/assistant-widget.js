(function () {
  function addMessage(messages, text, type) {
    const node = document.createElement('div');
    node.className = 'ai-widget-message ai-widget-message-' + type;
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function setupWidget(widget) {
    const endpoint = widget.getAttribute('data-endpoint');
    const toggle = widget.querySelector('.ai-widget-toggle');
    const close = widget.querySelector('.ai-widget-close');
    const form = widget.querySelector('.ai-widget-form');
    const prompt = widget.querySelector('.ai-widget-prompt');
    const chips = widget.querySelectorAll('.ai-widget-chip');
    const input = widget.querySelector('.ai-widget-input');
    const voice = widget.querySelector('.ai-widget-voice');
    const send = widget.querySelector('.ai-widget-send');
    const messages = widget.querySelector('.ai-widget-messages');

    toggle.addEventListener('click', function () {
      widget.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      input.focus();
    });

    close.addEventListener('click', function () {
      widget.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    prompt.addEventListener('change', function () {
      if (prompt.value) input.value = prompt.value;
      input.focus();
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        input.value = chip.getAttribute('data-prompt') || chip.textContent.trim();
        input.focus();
      });
    });

    input.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        form.requestSubmit();
      }
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voice.disabled = true;
      voice.textContent = 'Type';
    } else {
      voice.addEventListener('click', function () {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        voice.disabled = true;
        voice.textContent = 'Listening...';
        recognition.onresult = function (event) {
          input.value = event.results[0][0].transcript;
          input.focus();
        };
        recognition.onerror = function () {
          addMessage(messages, 'Voice input could not start. You can still type your question.', 'ai');
        };
        recognition.onend = function () {
          voice.disabled = false;
          voice.textContent = 'Talk';
        };
        recognition.start();
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;

      addMessage(messages, question, 'user');
      input.value = '';
      send.disabled = true;
      const pending = addMessage(messages, 'Thinking...', 'ai');

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        const data = await response.json().catch(function () { return {}; });
        pending.textContent = data.answer || data.error || 'The assistant could not answer right now.';
      } catch (_error) {
        pending.textContent = 'The assistant could not connect right now. Try again in a moment.';
      } finally {
        send.disabled = false;
        messages.scrollTop = messages.scrollHeight;
      }
    });
  }

  document.querySelectorAll('.ai-widget').forEach(setupWidget);
})();
