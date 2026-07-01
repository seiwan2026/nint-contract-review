/**
 * 主应用逻辑
 * 适配新版 SaaS 风格布局
 */

(function() {
    // ===== DOM 元素 =====
    const els = {
        // Sidebar
        sidebar: document.getElementById('sidebar'),
        navItems: document.querySelectorAll('.nav-item[data-page]'),
        pageTitle: document.getElementById('pageTitle'),

        // Pages
        pages: {
            workbench: document.getElementById('pageWorkbench'),
            config: document.getElementById('pageConfig'),
            settings: document.getElementById('pageSettings'),
        },

        // API Status
        apiStatus: document.getElementById('apiStatus'),
        statusDot: document.getElementById('statusDot'),
        statusText: document.getElementById('statusText'),

        // Workbench - Upload
        uploadZone: document.getElementById('uploadZone'),
        fileInput: document.getElementById('fileInput'),
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        btnChangeFile: document.getElementById('btnChangeFile'),

        // Workbench - Control
        btnStartReview: document.getElementById('btnStartReview'),
        btnStopReview: document.getElementById('btnStopReview'),
        btnDownloadReview: document.getElementById('btnDownloadReview'),
        btnClearPreview: document.getElementById('btnClearPreview'),
        reviewProgress: document.getElementById('reviewProgress'),
        progressFill: document.getElementById('progressFill'),

        // Workbench - Preview (split columns)
        originalBody: document.getElementById('originalBody'),
        reviewBody: document.getElementById('reviewBody'),
        originalBadge: document.getElementById('originalBadge'),
        reviewBadge: document.getElementById('reviewBadge'),

        // Config Page
        providerSelect: document.getElementById('providerSelect'),
        customEndpointRow: document.getElementById('customEndpointRow'),
        customEndpoint: document.getElementById('customEndpoint'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        btnToggleKey: document.getElementById('btnToggleKey'),
        modelInput: document.getElementById('modelInput'),
        btnSaveConfig: document.getElementById('btnSaveConfig'),

        // Review Points
        workbenchPoints: document.getElementById('workbenchPoints'),
        btnResetPoints: document.getElementById('btnResetPoints'),
        btnSavePoints: document.getElementById('btnSavePoints'),
        contractTypeSelect: document.getElementById('contractTypeSelect'),
        reviewStanceSelect: document.getElementById('reviewStanceSelect'),

        // Settings Page
        btnClearData: document.getElementById('btnClearData'),

        // Chat
        chatMascotWrapper: document.getElementById('chatMascotWrapper'),
        chatMascot: document.getElementById('chatMascot'),
        chatHeader: document.getElementById('chatHeader'),
        chatPanel: document.getElementById('chatPanel'),
        chatStatus: document.getElementById('chatStatus'),
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput'),
        btnSend: document.getElementById('btnSend'),

        // Toast & Loading
        toast: document.getElementById('toast'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
    };

    // ===== 状态 =====
    let state = {
        currentPage: 'workbench',
        currentFile: null,
        contractText: '',
        isReviewing: false,
        chatHistory: [],
        configLoaded: false,
        reviewContent: null,
    };

    // ===== 初始化 =====
    function init() {
        loadConfig();
        loadReviewPoints();
        bindEvents();
        initChatDrag();
        updateApiStatus();

        // 初始化聊天（通用模式，无需上传合同即可使用）
        state.chatHistory = [
            { role: 'system', content: getGeneralSystemPrompt() }
        ];
        updateChatStatus('general');
    }

    // ===== 页面切换 =====
    function switchPage(pageName) {
        state.currentPage = pageName;

        // 更新导航
        els.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // 更新页面
        Object.keys(els.pages).forEach(key => {
            const page = els.pages[key];
            if (page) {
                page.classList.toggle('active', key === pageName);
            }
        });

        // 更新标题
        const titles = {
            workbench: '工作台',
            config: '审核配置',
            settings: '设置',
        };
        els.pageTitle.textContent = titles[pageName] || '';
    }

    // ===== 配置管理 =====
    function loadConfig() {
        const config = AIReview.loadConfig();
        if (config) {
            els.providerSelect.value = config.provider || 'deepseek';
            els.apiKeyInput.value = config.apiKey || '';
            els.modelInput.value = config.model || '';
            if (config.provider === 'custom') {
                els.customEndpointRow.style.display = 'block';
                els.customEndpoint.value = config.customEndpoint || '';
            }
            state.configLoaded = true;
            updateApiStatus();
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

        // 保留已有的 reviewPoints
        const existingConfig = AIReview.loadConfig() || {};
        AIReview.saveConfig({
            provider, apiKey, model, customEndpoint,
            reviewPoints: existingConfig.reviewPoints
        });
        state.configLoaded = true;
        updateApiStatus();
        showToast('配置已保存', 'success');
    }

    // ===== 审核要点管理 =====
    function loadReviewPoints() {
        const points = AIReview.loadReviewPoints();
        if (els.workbenchPoints) els.workbenchPoints.value = points;
    }

    function saveReviewPoints(pointsText) {
        const config = AIReview.loadConfig() || {};
        config.reviewPoints = pointsText.trim();
        localStorage.setItem('contract_review_config', JSON.stringify(config));
        AIReview.config = config;
        if (els.workbenchPoints) els.workbenchPoints.value = pointsText;
        showToast('审核要点已保存', 'success');
    }

    function resetReviewPoints() {
        const defaultPoints = AIReview.getDefaultReviewPoints();
        if (els.workbenchPoints) els.workbenchPoints.value = defaultPoints;
        const config = AIReview.loadConfig() || {};
        delete config.reviewPoints;
        localStorage.setItem('contract_review_config', JSON.stringify(config));
        AIReview.config = config;
        showToast('已恢复默认审核要点', 'success');
    }

    function updateApiStatus() {
        if (state.configLoaded && AIReview.config && AIReview.config.apiKey) {
            els.statusDot.classList.add('connected');
            els.statusText.textContent = 'API 已配置';
        } else {
            els.statusDot.classList.remove('connected');
            els.statusText.textContent = '未配置 API';
        }
    }

    // ===== 清空预览 =====
    function clearPreview() {
        // 清空原始合同
        els.originalBody.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>请先上传合同文件</p>
            <span class="empty-hint">支持 .docx、.pdf 格式</span>
        </div>`;
        if (els.originalBadge) {
            els.originalBadge.textContent = '未上传';
            els.originalBadge.className = 'split-badge badge-original';
        }

        // 清空审核意见
        els.reviewBody.innerHTML = `<div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
            <p>AI 审核结果将显示在这里</p>
            <span class="empty-hint">上传文件后点击「开始审核」</span>
        </div>`;
        els.reviewBadge.textContent = '等待审核';
        els.reviewBadge.className = 'split-badge';

        // 重置状态
        state.contractText = '';
        state.chatHistory = [
            { role: 'system', content: getGeneralSystemPrompt() }
        ];
        updateChatStatus('general');
        if (els.fileInfo) els.fileInfo.style.display = 'none';
        els.btnStartReview.disabled = true;
        els.btnDownloadReview.disabled = true;
        state.reviewContent = null;

        showToast('预览已清空', 'success');
    }

    // ===== 下载审核结果 =====
    function downloadReview() {
        if (!state.reviewContent) {
            showToast('请先完成审核', 'warning');
            return;
        }

        // 生成 Word 兼容格式报告
        var title = '合同智能审核报告';
        var dateStr = new Date().toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        var contractTextEscaped = (state.contractText || '')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n/g, '</p><p class=clause>');
        var reviewHtmlInDoc = state.reviewContent;

        var docHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
'<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->' +
'<title>' + title + '</title>' +
'<style>' +
' @page { size: A4; margin: 2.54cm 3.18cm 2.54cm 3.18cm; mso-header-margin: 1.5cm; mso-footer-margin: 1.25cm; }' +
' body { font-family: "PingFang SC","Microsoft YaHei","SimSun",serif; font-size: 14pt; line-height: 2; color: #1e293b; }' +
' .report-title { text-align: center; font-size: 22pt; font-weight: bold; margin: 80pt 0 40pt 0; padding-bottom: 20pt; border-bottom: 2pt solid #6366f1; color: #1e293b; }' +
' .report-meta { text-align: center; font-size: 11pt; color: #64748b; margin: 20pt 0 50pt 0; }' +
' .report-meta p { margin: 6pt 0; }' +
' h1 { font-size: 18pt; font-weight: bold; margin: 28pt 0 16pt 0; padding-bottom: 8pt; border-bottom: 1.5pt solid #6366f1; color: #4f46e5; }' +
' h2 { font-size: 15pt; font-weight: bold; margin: 22pt 0 10pt 0; color: #3730a3; }' +
' h3 { font-size: 13pt; font-weight: bold; margin: 16pt 0 8pt 0; color: #1e293b; }' +
' h4 { font-size: 12pt; font-weight: bold; margin: 12pt 0 6pt 0; color: #334155; }' +
' p { margin: 6pt 0; text-align: justify; text-justify: inter-ideograph; }' +
' p.clause { margin: 3pt 0; text-indent: 0; }' +
' strong, b { color: #1e293b; }' +
' ul, ol { margin: 8pt 0 8pt 24pt; }' +
' li { margin: 4pt 0; }' +
' blockquote { margin: 14pt 0; padding: 10pt 16pt; border-left: 3pt solid #ef4444; background: #fef2f2; font-size: 13pt; }' +
' code { font-size: 11pt; background: #f8fafc; padding: 2pt 6pt; border: 1pt solid #e2e8f0; border-radius: 3pt; }' +
' pre { background: #f8fafc; border: 1pt solid #e2e8f0; padding: 12pt; font-size: 11pt; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }' +
' .contract-section { background: #f8fafc; border: 1pt solid #e2e8f0; padding: 16pt 20pt; margin: 16pt 0; }' +
' .contract-section h2 { margin-top: 0; }' +
' table { width: 100%; border-collapse: collapse; margin: 14pt 0; }' +
' th, td { border: 1pt solid #cbd5e1; padding: 8pt 12pt; text-align: left; font-size: 12pt; vertical-align: top; }' +
' th { background: #f1f5f9; font-weight: bold; }' +
' hr { border: none; border-top: 1pt solid #e2e8f0; margin: 20pt 0; }' +
' .report-footer { margin-top: 36pt; padding-top: 14pt; border-top: 1pt solid #e2e8f0; font-size: 10pt; color: #94a3b8; text-align: center; }' +
' .page-break { page-break-before: always; }' +
'</style>' +
'</head>' +
'<body>' +
'<div class="report-title">' + title + '</div>' +
'<div class="report-meta">' +
'  <p>生成时间：' + dateStr + '</p>' +
'  <p>审核工具：合同智能审核助手</p>' +
'  <p>本文档为 AI 自动生成，仅供参考，不构成法律意见</p>' +
'</div>' +
'<hr>' +
'<h1>一、原始合同内容</h1>' +
'<div class="contract-section">' +
'  <p class=clause>' + contractTextEscaped + '</p>' +
'</div>' +
'<div class="page-break"></div>' +
'<h1>二、AI 审核意见</h1>' +
reviewHtmlInDoc +
'<hr>' +
'<div class="report-footer">' +
'  <p>生成时间：' + dateStr + '</p>' +
'  <p>本报告由合同智能审核助手自动生成，审核结果仅供内部参考，不构成正式法律意见。</p>' +
'  <p>如需出具正式法律意见书，请咨询专业律师。</p>' +
'</div>' +
'</body>' +
'</html>';

        var bom = '﻿';
        var blob = new Blob([bom + docHtml], { type: 'application/msword;charset=UTF-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '合同审核结果_' + new Date().toISOString().slice(0,10) + '.doc';
        a.click();
        URL.revokeObjectURL(url);
        showToast('审核结果已下载（Word 格式）', 'success');
    }
    // ===== 事件绑定 =====
    function bindEvents() {
        // 侧边栏导航
        els.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                switchPage(item.dataset.page);
            });
        });

        // 审核控制按钮
        els.btnStartReview.addEventListener('click', startReview);
        els.btnStopReview.addEventListener('click', stopReview);
        if (els.btnDownloadReview) {
            els.btnDownloadReview.addEventListener('click', downloadReview);
        }
        if (els.btnClearPreview) {
            els.btnClearPreview.addEventListener('click', () => {
                if (confirm('确定要清空预览吗？这将清除上传的合同和审核结果。')) {
                    clearPreview();
                }
            });
        }

        // 文件上传
        els.uploadZone.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        els.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            els.uploadZone.classList.add('dragover');
        });

        els.uploadZone.addEventListener('dragleave', () => {
            els.uploadZone.classList.remove('dragover');
        });

        els.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            els.uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });

        els.btnChangeFile.addEventListener('click', () => els.fileInput.click());

        // AI 审核
        els.btnStartReview.addEventListener('click', startReview);
        els.btnStopReview.addEventListener('click', stopReview);

        // 配置页面
        els.providerSelect.addEventListener('change', () => {
            els.customEndpointRow.style.display =
                els.providerSelect.value === 'custom' ? 'block' : 'none';
        });

        els.btnToggleKey.addEventListener('click', () => {
            const type = els.apiKeyInput.type;
            els.apiKeyInput.type = type === 'password' ? 'text' : 'password';
        });

        els.btnSaveConfig.addEventListener('click', saveConfig);

        // 审核要点 - 工作台
        if (els.btnSavePoints) {
            els.btnSavePoints.addEventListener('click', () => {
                saveReviewPoints(els.workbenchPoints.value);
            });
        }
        if (els.btnResetPoints) {
            els.btnResetPoints.addEventListener('click', resetReviewPoints);
        }

    // ===== 审核要点管理 =====
        els.btnClearData.addEventListener('click', () => {
            if (confirm('确定要清空所有本地数据吗？这将删除 API Key、审核要点和聊天记录。')) {
                localStorage.removeItem('contract_review_config');
                state.configLoaded = false;
                els.apiKeyInput.value = '';
                els.modelInput.value = '';
                els.customEndpoint.value = '';
                els.providerSelect.value = 'deepseek';
                els.customEndpointRow.style.display = 'none';
                AIReview.config = null;
                resetReviewPoints();
                updateApiStatus();
                showToast('本地数据已清空', 'success');
            }
        });

        // 聊天
        els.btnSend.addEventListener('click', sendChatMessage);
        els.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // 聊天窗口拖拽缩放
        els.chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // 触屏设备：点击桌宠切换展开/收起
        els.chatMascot.addEventListener('click', (e) => {
            if (window.matchMedia('(hover: none)').matches) {
                e.stopPropagation();
                els.chatMascotWrapper.classList.toggle('open');
            }
        });

        // 点击面板外部关闭（触屏设备）
        document.addEventListener('click', (e) => {
            if (!els.chatMascotWrapper.contains(e.target) && window.matchMedia('(hover: none)').matches) {
                els.chatMascotWrapper.classList.remove('open');
            }
        });
    }

    // ===== 文件处理 =====
    async function handleFile(file) {
        if (!file) return;

        const validExts = ['.docx', '.pdf'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExts.includes(ext)) {
            showToast(`不支持的文件格式: ${ext}，请上传 .docx 或 .pdf`, 'error');
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

            // 显示文件信息
            els.fileName.textContent = file.name;
            els.fileSize.textContent = FileParser.formatFileSize(file.size);
            els.fileInfo.style.display = 'block';

            // 显示原文
            els.originalBody.innerHTML = `<div class="preview-text">${result.html}</div>`;
            if (els.originalBadge) {
                els.originalBadge.textContent = '已上传';
                els.originalBadge.className = 'split-badge badge-original';
            }

            // 启用审核按钮
            els.btnStartReview.disabled = false;

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
            switchPage('config');
            return;
        }

        if (!state.contractText) {
            showToast('请先上传合同文件', 'warning');
            return;
        }

        state.isReviewing = true;
        els.btnStartReview.style.display = 'none';
        els.btnStopReview.style.display = 'flex';
        els.reviewProgress.style.display = 'block';
        els.progressFill.style.width = '30%';
        els.reviewBadge.textContent = '审核中...';
        els.reviewBadge.className = 'preview-badge reviewing';

        // 初始化审核内容区域
        els.reviewBody.innerHTML = '<div class="review-result" id="reviewResult"><p style="color:var(--text-muted)">AI 正在分析合同内容...</p></div>';
        const reviewResult = document.getElementById('reviewResult');

        // 获取当前审核要点和审核立场
        const currentPoints = els.workbenchPoints ? els.workbenchPoints.value.trim() : '';
        const currentStance = els.reviewStanceSelect ? els.reviewStanceSelect.value : 'neutral';
        if (currentPoints && AIReview.config) {
            AIReview.config.reviewPoints = currentPoints;
            const saved = JSON.parse(localStorage.getItem('contract_review_config') || '{}');
            saved.reviewPoints = currentPoints;
            localStorage.setItem('contract_review_config', JSON.stringify(saved));
        }

        let hasContent = false;
        let progressTimer = null;

        // 模拟进度动画
        let progress = 30;
        progressTimer = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 8;
                els.progressFill.style.width = Math.min(progress, 90) + '%';
            }
        }, 800);

        await AIReview.review(
            state.contractText,
            // onChunk
            (chunk, fullContent) => {
                if (!hasContent) {
                    reviewResult.innerHTML = '';
                    hasContent = true;
                }
                const html = AIReview.markdownToHtml(fullContent);
                const safeHtml = DOMPurify.sanitize(html);
                reviewResult.innerHTML = safeHtml;
                els.reviewBody.scrollTop = els.reviewBody.scrollHeight;
            },
            // onComplete
            (fullContent) => {
                clearInterval(progressTimer);
                els.progressFill.style.width = '100%';

                setTimeout(() => {
                    state.isReviewing = false;
                    els.btnStartReview.style.display = 'flex';
                    els.btnStopReview.style.display = 'none';
                    els.reviewProgress.style.display = 'none';
                    els.reviewBadge.textContent = '审核完成';
                    els.reviewBadge.className = 'preview-badge completed';
                    els.btnDownloadReview.disabled = false;
                    showToast('AI 审核完成', 'success');

                    // 保存审核原始内容（用于下载）
                    state.reviewContent = fullContent;

                    // 切换到合同对话模式
                    state.chatHistory = [
                        { role: 'system', content: AIReview.getChatSystemPrompt(state.contractText) }
                    ];
                    updateChatStatus('contract');
                }, 500);
            },
            // onError
            (err) => {
                clearInterval(progressTimer);
                state.isReviewing = false;
                els.btnStartReview.style.display = 'flex';
                els.btnStopReview.style.display = 'none';
                els.reviewProgress.style.display = 'none';
                els.reviewBadge.textContent = '审核失败';
                els.reviewBadge.className = 'preview-badge';
                showToast(err.message, 'error');
                if (!hasContent) {
                    reviewResult.innerHTML = `<p style="color:var(--danger)">审核失败: ${err.message}</p>`;
                }
            },
            // options: 立场和自定义要点
            {
                stance: currentStance,
                customPoints: currentPoints || undefined
            }
        );
    }

    function stopReview() {
        AIReview.cancel();
        state.isReviewing = false;
        els.btnStartReview.style.display = 'flex';
        els.btnStopReview.style.display = 'none';
        els.reviewProgress.style.display = 'none';
        els.reviewBadge.textContent = '已取消';
        els.reviewBadge.className = 'preview-badge';
    }

    // ===== 聊天功能 =====

    /**
     * 获取通用系统提示词（未上传合同时使用）
     */
    function getGeneralSystemPrompt() {
        return '你是一个有用的 AI 法律助手，基于 DeepSeek 大模型。你可以回答法律问题、提供法律知识解释、协助理解合同条款，也可以回答其他通用问题。请用中文回答，保持专业、准确、简洁。';
    }

    /**
     * 更新聊天状态显示
     * @param {string} mode - 'general' | 'contract'
     */
    function updateChatStatus(mode) {
        if (els.chatStatus) {
            els.chatStatus.textContent = mode === 'contract' ? '合同对话' : '通用对话';
        }
        if (els.chatInput) {
            els.chatInput.placeholder = mode === 'contract'
                ? '针对合同内容提问...'
                : '问我任何问题...';
        }
    }

    function addChatMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;

        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

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
            switchPage('config');
            return;
        }

        // 添加用户消息
        addChatMessage('user', text);
        state.chatHistory.push({ role: 'user', content: text });
        els.chatInput.value = '';
        els.chatInput.style.height = 'auto';
        els.btnSend.disabled = true;

        // 创建助手消息占位
        const assistantMsg = document.createElement('div');
        assistantMsg.className = 'chat-message assistant';
        assistantMsg.innerHTML = '<div style="color:var(--text-muted)">思考中...</div>';
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

    // ===== 聊天窗口拖拽 =====
    function initChatDrag() {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        els.chatHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = els.chatMascotWrapper.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            els.chatMascotWrapper.style.transition = 'none';
            // 拖拽时强制面板保持打开
            els.chatMascotWrapper.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            els.chatMascotWrapper.style.left = (startLeft + dx) + 'px';
            els.chatMascotWrapper.style.top = (startTop + dy) + 'px';
            els.chatMascotWrapper.style.right = 'auto';
            els.chatMascotWrapper.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                els.chatMascotWrapper.style.transition = '';
                els.chatMascotWrapper.classList.remove('dragging');
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
