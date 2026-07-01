/**
 * 主应用逻辑
 */

(function() {
    // ===== DOM 元素 =====
    const els = {
        btnConfig: document.getElementById('btnConfig'),
        configPanel: document.getElementById('configPanel'),
        providerSelect: document.getElementById('providerSelect'),
        customEndpointGroup: document.getElementById('customEndpointGroup'),
        customEndpoint: document.getElementById('customEndpoint'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        modelInput: document.getElementById('modelInput'),
        btnSaveConfig: document.getElementById('btnSaveConfig'),
        btnCloseConfig: document.getElementById('btnCloseConfig'),
        uploadSection: document.getElementById('uploadSection'),
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        btnUpload: document.getElementById('btnUpload'),
        previewSection: document.getElementById('previewSection'),
        btnBack: document.getElementById('btnBack'),
        filenameDisplay: document.getElementById('filenameDisplay'),
        btnStartReview: document.getElementById('btnStartReview'),
        btnStopReview: document.getElementById('btnStopReview'),
        originalContent: document.getElementById('originalContent'),
        reviewContent: document.getElementById('reviewContent'),
        originalBadge: document.getElementById('originalBadge'),
        reviewBadge: document.getElementById('reviewBadge'),
        chatWidget: document.getElementById('chatWidget'),
        chatHeader: document.getElementById('chatHeader'),
        chatMinimize: document.getElementById('chatMinimize'),
        chatClose: document.getElementById('chatClose'),
        chatToggle: document.getElementById('chatToggle'),
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput'),
        btnSend: document.getElementById('btnSend'),
        toast: document.getElementById('toast'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        resizeHandle: document.getElementById('resizeHandle'),
    };

    // ===== 状态 =====
    let state = {
        currentFile: null,
        contractText: '',
        isReviewing: false,
        chatHistory: [],
        configLoaded: false,
    };

    // ===== 初始化 =====
    function init() {
        loadConfig();
        bindEvents();
        initResize();
        initChatDrag();
        addWelcomeMessage();
    }

    // ===== 配置管理 =====
    function loadConfig() {
        const config = AIReview.loadConfig();
        if (config) {
            els.providerSelect.value = config.provider || 'openai';
            els.apiKeyInput.value = config.apiKey || '';
            els.modelInput.value = config.model || '';
            if (config.provider === 'custom') {
                els.customEndpointGroup.style.display = 'block';
                els.customEndpoint.value = config.customEndpoint || '';
            }
            state.configLoaded = true;
            els.btnConfig.classList.add('active');
        }
    }

    function saveConfig() {
        const provider = els.providerSelect.value;
        const apiKey = els.apiKeyInput.value.trim();
        const model = els.modelInput.value.trim();
        const customEndpoint = els.customEndpoint.value.trim();

        if (!apiKey) {
            showToast('请输入 API Key', 'error');
            return;
        }

        if (provider === 'custom' && !customEndpoint) {
            showToast('请输入自定义接口地址', 'error');
            return;
        }

        AIReview.saveConfig({ provider, apiKey, model, customEndpoint });
        state.configLoaded = true;
        els.btnConfig.classList.add('active');
        showToast('配置已保存', 'success');
        els.configPanel.classList.remove('show');
    }

    // ===== 事件绑定 =====
    function bindEvents() {
        // 配置面板
        els.btnConfig.addEventListener('click', () => {
            els.configPanel.classList.toggle('show');
        });

        els.btnSaveConfig.addEventListener('click', saveConfig);
        els.btnCloseConfig.addEventListener('click', () => {
            els.configPanel.classList.remove('show');
        });

        els.providerSelect.addEventListener('change', () => {
            els.customEndpointGroup.style.display =
                els.providerSelect.value === 'custom' ? 'block' : 'none';
        });

        // 点击面板外部关闭
        document.addEventListener('click', (e) => {
            if (!els.configPanel.contains(e.target) && !els.btnConfig.contains(e.target)) {
                els.configPanel.classList.remove('show');
            }
        });

        // 文件上传
        els.btnUpload.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        // 拖拽上传
        els.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            els.uploadArea.classList.add('dragover');
        });

        els.uploadArea.addEventListener('dragleave', () => {
            els.uploadArea.classList.remove('dragover');
        });

        els.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            els.uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });

        // 返回上传
        els.btnBack.addEventListener('click', () => {
            els.previewSection.style.display = 'none';
            els.uploadSection.style.display = 'flex';
            els.originalContent.innerHTML = '<div class="placeholder-text">合同内容将显示在这里</div>';
            els.reviewContent.innerHTML = `
                <div class="placeholder-text">
                    <div>点击「开始审核」按钮，AI 将分析合同并给出修改建议</div>
                    <div class="review-tips">
                        <strong>审核要点：</strong>
                        <ul>
                            <li>合同主体信息完整性</li>
                            <li>权利义务条款对等性</li>
                            <li>违约责任明确性</li>
                            <li>争议解决条款合理性</li>
                            <li>隐藏风险条款识别</li>
                            <li>付款/交付条款清晰度</li>
                        </ul>
                    </div>
                </div>`;
            els.reviewBadge.textContent = '等待审核';
            els.reviewBadge.className = 'panel-badge';
            state.currentFile = null;
            state.contractText = '';
            state.chatHistory = [];
            els.chatMessages.innerHTML = '';
            addWelcomeMessage();
        });

        // AI 审核
        els.btnStartReview.addEventListener('click', startReview);
        els.btnStopReview.addEventListener('click', stopReview);

        // 聊天
        els.btnSend.addEventListener('click', sendChatMessage);
        els.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        els.chatMinimize.addEventListener('click', () => {
            els.chatWidget.classList.add('minimized');
            els.chatToggle.style.display = 'block';
        });

        els.chatClose.addEventListener('click', () => {
            els.chatWidget.classList.add('minimized');
            els.chatToggle.style.display = 'none';
        });

        els.chatToggle.addEventListener('click', () => {
            els.chatWidget.classList.remove('minimized');
            els.chatToggle.style.display = 'none';
        });
    }

    // ===== 文件处理 =====
    async function handleFile(file) {
        if (!file) return;

        const validExts = ['.docx', '.pdf'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExts.includes(ext)) {
            showToast(`不支持的文件格式: ${ext}，请上传 .docx 或 .pdf 文件`, 'error');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast('文件大小超过 20MB 限制', 'error');
            return;
        }

        state.currentFile = file;
        els.loadingText.textContent = '正在解析文件...';
        els.loadingOverlay.style.display = 'flex';

        try {
            const result = await FileParser.parse(file);
            state.contractText = result.text;

            // 显示原文
            els.originalContent.innerHTML = result.html;
            els.originalBadge.textContent = `${FileParser.formatFileSize(file.size)} · ${result.text.length} 字`;

            // 显示文件名
            els.filenameDisplay.textContent = file.name;

            // 切换视图
            els.uploadSection.style.display = 'none';
            els.previewSection.style.display = 'flex';

            showToast('文件解析成功', 'success');

            // 自动开始审核（如果配置了 API Key）
            if (state.configLoaded) {
                setTimeout(() => {
                    if (confirm('是否立即开始 AI 审核？')) {
                        startReview();
                    }
                }, 500);
            }
        } catch (err) {
            showToast(`文件解析失败: ${err.message}`, 'error');
            console.error(err);
        } finally {
            els.loadingOverlay.style.display = 'none';
            els.fileInput.value = '';
        }
    }

    // ===== AI 审核 =====
    async function startReview() {
        if (state.isReviewing) return;

        if (!state.configLoaded || !AIReview.config || !AIReview.config.apiKey) {
            showToast('请先配置 API Key', 'warning');
            els.configPanel.classList.add('show');
            return;
        }

        if (!state.contractText) {
            showToast('请先上传合同文件', 'warning');
            return;
        }

        state.isReviewing = true;
        els.btnStartReview.style.display = 'none';
        els.btnStopReview.style.display = 'inline-block';
        els.reviewBadge.textContent = '审核中...';
        els.reviewBadge.className = 'panel-badge reviewing';

        // 初始化审核内容区域
        els.reviewContent.innerHTML = '<div class="review-result" id="reviewResult"></div>';
        const reviewResult = document.getElementById('reviewResult');
        reviewResult.innerHTML = '<p style="color:var(--gray-400)">AI 正在分析合同内容...</p>';

        let hasContent = false;

        await AIReview.review(
            state.contractText,
            // onChunk
            (chunk, fullContent) => {
                if (!hasContent) {
                    reviewResult.innerHTML = '';
                    hasContent = true;
                }
                // 实时渲染 Markdown
                const html = AIReview.markdownToHtml(fullContent);
                const safeHtml = DOMPurify.sanitize(html);
                reviewResult.innerHTML = safeHtml;
                // 自动滚动到底部
                els.reviewContent.scrollTop = els.reviewContent.scrollHeight;
            },
            // onComplete
            (fullContent) => {
                state.isReviewing = false;
                els.btnStartReview.style.display = 'inline-block';
                els.btnStopReview.style.display = 'none';
                els.reviewBadge.textContent = '审核完成';
                els.reviewBadge.className = 'panel-badge completed';
                showToast('AI 审核完成', 'success');

                // 添加系统消息到聊天历史
                state.chatHistory.push({
                    role: 'system',
                    content: AIReview.getChatSystemPrompt(state.contractText)
                });
            },
            // onError
            (err) => {
                state.isReviewing = false;
                els.btnStartReview.style.display = 'inline-block';
                els.btnStopReview.style.display = 'none';
                els.reviewBadge.textContent = '审核失败';
                els.reviewBadge.className = 'panel-badge';
                showToast(err.message, 'error');
                if (!hasContent) {
                    reviewResult.innerHTML = `<p style="color:var(--danger)">审核失败: ${err.message}</p>`;
                }
            }
        );
    }

    function stopReview() {
        AIReview.cancel();
        state.isReviewing = false;
        els.btnStartReview.style.display = 'inline-block';
        els.btnStopReview.style.display = 'none';
        els.reviewBadge.textContent = '已取消';
        els.reviewBadge.className = 'panel-badge';
    }

    // ===== 聊天功能 =====
    function addWelcomeMessage() {
        addChatMessage('assistant', '你好！我是你的合同审核 AI 助手。\n\n请先上传合同文件并配置 API Key，我可以帮你：\n- 自动审核合同条款\n- 回答合同相关法律问题\n- 提供修改建议和风险提示');
    }

    function addChatMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;

        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // 将 Markdown 转为 HTML
        let htmlContent = '';
        if (typeof marked !== 'undefined') {
            htmlContent = marked.parse(content);
        } else {
            htmlContent = content.replace(/\n/g, '<br>');
        }

        msgDiv.innerHTML = `
            <div>${DOMPurify.sanitize(htmlContent)}</div>
            <div class="message-time">${time}</div>
        `;

        els.chatMessages.appendChild(msgDiv);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    async function sendChatMessage() {
        const text = els.chatInput.value.trim();
        if (!text) return;

        if (!state.configLoaded || !AIReview.config || !AIReview.config.apiKey) {
            showToast('请先配置 API Key', 'warning');
            els.configPanel.classList.add('show');
            return;
        }

        // 添加用户消息
        addChatMessage('user', text);
        state.chatHistory.push({ role: 'user', content: text });
        els.chatInput.value = '';
        els.btnSend.disabled = true;

        // 创建助手消息占位
        const assistantMsg = document.createElement('div');
        assistantMsg.className = 'chat-message assistant';
        assistantMsg.innerHTML = '<div style="color:var(--gray-400)">思考中...</div>';
        els.chatMessages.appendChild(assistantMsg);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

        let fullContent = '';

        await AIReview.chat(
            state.chatHistory,
            // onChunk
            (chunk, full) => {
                fullContent = full;
                let htmlContent = '';
                if (typeof marked !== 'undefined') {
                    htmlContent = marked.parse(fullContent);
                } else {
                    htmlContent = fullContent.replace(/\n/g, '<br>');
                }
                assistantMsg.innerHTML = `
                    <div>${DOMPurify.sanitize(htmlContent)}</div>
                    <div class="message-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                `;
                els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
            },
            // onComplete
            (full) => {
                state.chatHistory.push({ role: 'assistant', content: full });
                els.btnSend.disabled = false;
            },
            // onError
            (err) => {
                assistantMsg.innerHTML = `<div style="color:var(--danger)">错误: ${err.message}</div>`;
                els.btnSend.disabled = false;
            }
        );
    }

    // ===== 分栏拖拽调整大小 =====
    function initResize() {
        let isResizing = false;

        els.resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const container = document.querySelector('.split-view');
            const rect = container.getBoundingClientRect();
            const leftWidth = ((e.clientX - rect.left) / rect.width) * 100;
            if (leftWidth > 20 && leftWidth < 80) {
                document.querySelector('.panel-left').style.width = leftWidth + '%';
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    }

    // ===== 聊天窗口拖拽 =====
    function initChatDrag() {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        els.chatHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = els.chatWidget.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            els.chatWidget.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            els.chatWidget.style.left = (startLeft + dx) + 'px';
            els.chatWidget.style.top = (startTop + dy) + 'px';
            els.chatWidget.style.right = 'auto';
            els.chatWidget.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                els.chatWidget.style.transition = '';
            }
        });
    }

    // ===== Toast 提示 =====
    function showToast(message, type = 'info') {
        els.toast.textContent = message;
        els.toast.className = 'toast show ' + type;
        setTimeout(() => {
            els.toast.classList.remove('show');
        }, 3000);
    }

    // ===== 启动 =====
    init();
})();
