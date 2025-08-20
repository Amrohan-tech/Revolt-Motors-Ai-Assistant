document.addEventListener('DOMContentLoaded', function() {
    const voiceButton = document.getElementById('voiceButton');
    const chatContainer = document.getElementById('chatContainer');
    const statusText = document.getElementById('statusText');
    const languageSelect = document.getElementById('languageSelect');
    const clearChatBtn = document.getElementById('clearChat');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');
    
    // --- NEW: For Web Speech API ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    // ---------------------------------

    let isListening = false;
    let conversationId = null;

    // Check for browser support
    if (!SpeechRecognition) {
        showNotification('Your browser does not support voice recognition. Please use Chrome or Edge.', 10000);
        voiceButton.disabled = true;
        updateStatus('Unsupported Browser', 'error');
    } else {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after a single utterance
        recognition.interimResults = false; // We only want final results

        recognition.onstart = () => {
            isListening = true;
            voiceButton.classList.add('listening');
            updateStatus('Listening...', 'listening');
        };

        recognition.onend = () => {
            isListening = false;
            voiceButton.classList.remove('listening');
            updateStatus('Ready to listen', 'ready');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            showNotification(`Error: ${event.error}. Please try again.`);
            isListening = false;
            voiceButton.classList.remove('listening');
            updateStatus('Ready to listen', 'ready');
        };
        
        // This is where we get the transcribed text
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            if (transcript) {
                sendTextInput(transcript);
            }
        };
    }
    
    // Initialize conversation on page load
    initializeConversation();
    
    voiceButton.addEventListener('click', toggleListening);
    clearChatBtn.addEventListener('click', clearChat);
    
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.textContent;
            sendTextInput(text);
        });
    });

    function toggleListening() {
        if (!conversationId) {
            showNotification('Still initializing. Please wait a moment.');
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            recognition.lang = languageSelect.value;
            recognition.start();
        }
    }
    
    async function initializeConversation() {
        try {
            updateStatus('Initializing...', 'processing');
            const response = await fetch('/api/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok) {
                conversationId = data.conversationId;
                updateStatus('Ready to listen', 'ready');
                chatContainer.innerHTML = ''; // Clear initial message
                addMessage(data.response, 'ai');
            } else {
                throw new Error(data.response || 'Failed to initialize conversation');
            }
        } catch (error) {
            console.error('Error initializing conversation:', error);
            updateStatus('Connection Error', 'error');
            addMessage(`Initialization failed: ${error.message}`, 'ai');
            showNotification('Could not connect to the AI assistant.', 5000);
        }
    }

    async function sendTextInput(text) {
        if (!conversationId) return;
        
        addMessage(text, 'user');
        updateStatus('Rev is thinking...', 'processing');
        
        try {
            const response = await fetch('/api/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId, text })
            });
            
            const data = await response.json();

            if (response.ok) {
                addMessage(data.response, 'ai');
            } else {
                throw new Error(data.response || 'An error occurred');
            }

        } catch (error) {
            console.error('Error sending text:', error);
            addMessage(`Sorry, there was an error: ${error.message}`, 'ai');
        } finally {
            updateStatus('Ready to listen', 'ready');
        }
    }

    function addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type === 'user' ? 'user-message' : 'ai-message');
        
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${type === 'user' ? 'fa-user' : 'fa-bolt'}"></i>
            </div>
            <div class="message-content">
                <p>${text}</p>
                <span class="message-time">${time}</span>
            </div>
        `;
        
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    function clearChat() {
        chatContainer.innerHTML = '';
        initializeConversation(); // Re-initialize to get a fresh greeting and conversation ID
        showNotification('Conversation cleared');
    }

    function showNotification(message, duration = 3000) {
        notificationText.textContent = message;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), duration);
    }
    
    function updateStatus(text, state) {
        statusText.textContent = text;
        const indicatorDot = document.querySelector('.indicator-dot');
        indicatorDot.className = 'indicator-dot'; // Reset class
        
        const colorMap = {
            ready: '#4cc9f0',
            processing: '#fca311',
            listening: '#e63946',
            error: '#d00000'
        };
        indicatorDot.style.backgroundColor = colorMap[state] || colorMap.ready;
    }
});