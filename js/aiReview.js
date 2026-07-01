/**
 * AI 审核模块
 * 支持 OpenAI、Claude 和自定义 OpenAI 兼容接口
 */

const AIReview = {
    config: null,
    abortController: null,

    /**
     * 加载配置
     */
    loadConfig() {
        const saved = localStorage.getItem('contract_review_config');
        if (saved) {
            this.config = JSON.parse(saved);
            return this.config;
        }
        return null;
    },

    /**
     * 保存配置
     * @param {Object} config
     */
    saveConfig(config) {
        this.config = config;
        localStorage.setItem('contract_review_config', JSON.stringify(config));
    },

    /**
     * 获取默认审核提示词
     * @returns {string}
     */
    getReviewPrompt() {
        return `你是一位拥有20年经验的资深法务专家，擅长合同审核与风险识别。请对以下合同进行全面审核，重点关注：

## 审核维度
1. **主体信息完整性**：签约主体名称、地址、联系方式、资质是否完整准确
2. **权利义务对等性**：双方权利义务是否平衡，是否存在显失公平的条款
3. **违约责任明确性**：违约情形、违约金计算方式、赔偿范围是否清晰
4. **争议解决条款**：管辖法院/仲裁机构约定是否合理、明确
5. **隐藏风险条款**：免责条款、单方变更权、自动续约等可能损害一方利益的条款
6. **付款与交付**：金额、时间、方式、验收标准是否清晰无歧义
7. **保密与知识产权**：保密范围、期限、知识产权归属约定是否明确
8. **终止与解除**：合同终止条件、提前解除程序、善后处理是否合理

## 输出格式要求
请按以下结构输出审核意见：

### 一、总体评估
简要评价合同整体质量、风险等级（高/中/低）

### 二、逐条审核意见
每条意见包含：
- **【原文】**：被审核的原文段落（引用原文，不要修改）
- **【问题】**：发现的问题或风险点
- **【修改建议】**：建议修改后的文本（如有）
- **【法律依据/风险提示】**：相关法律依据或风险说明

### 三、修改建议汇总
列出建议修改的核心条款清单

### 四、特别风险提示
如有重大法律风险，单独重点提示

请用中文回答，保持专业、准确、简洁。`;
    },

    /**
     * 获取聊天提示词
     * @param {string} contractText
     * @returns {string}
     */
    getChatSystemPrompt(contractText) {
        return `你是一位资深法务专家，正在协助审核一份合同。以下是合同内容（已脱敏处理）：

${contractText.substring(0, 8000)}

请基于以上合同内容回答用户的问题。回答要专业、准确、简洁，必要时引用合同原文条款。如果用户的问题与合同无关，也可以从一般法律角度回答。`;
    },

    /**
     * 构建 API 请求参数
     * @param {Array} messages
     * @returns {Object}
     */
    buildRequestBody(messages) {
        const { provider, model } = this.config;
        const modelName = model || this.getDefaultModel(provider);

        if (provider === 'claude') {
            return {
                model: modelName,
                max_tokens: 4096,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                stream: true
            };
        } else {
            // OpenAI 和自定义接口
            return {
                model: modelName,
                messages: messages,
                temperature: 0.3,
                max_tokens: 4096,
                stream: true
            };
        }
    },

    /**
     * 获取默认模型名称
     * @param {string} provider
     * @returns {string}
     */
    getDefaultModel(provider) {
        switch (provider) {
            case 'openai': return 'gpt-4';
            case 'claude': return 'claude-3-sonnet-20240229';
            default: return 'gpt-3.5-turbo';
        }
    },

    /**
     * 获取 API 端点
     * @returns {string}
     */
    getEndpoint() {
        const { provider, customEndpoint } = this.config;
        switch (provider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'claude':
                return 'https://api.anthropic.com/v1/messages';
            case 'custom':
                return customEndpoint || '';
            default:
                return '';
        }
    },

    /**
     * 获取请求头
     * @returns {Object}
     */
    getHeaders() {
        const { provider, apiKey } = this.config;
        const headers = {
            'Content-Type': 'application/json'
        };

        if (provider === 'claude') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        return headers;
    },

    /**
     * 执行审核（流式输出）
     * @param {string} contractText
     * @param {Function} onChunk - 收到数据块时的回调
     * @param {Function} onComplete - 完成时的回调
     * @param {Function} onError - 错误时的回调
     */
    async review(contractText, onChunk, onComplete, onError) {
        if (!this.config || !this.config.apiKey) {
            onError(new Error('请先配置 API Key'));
            return;
        }

        this.abortController = new AbortController();

        const messages = [
            { role: 'system', content: this.getReviewPrompt() },
            { role: 'user', content: `请审核以下合同内容：\n\n${contractText}` }
        ];

        // Claude 不使用 system role，将其合并到 user message
        if (this.config.provider === 'claude') {
            messages[1].content = messages[0].content + '\n\n' + messages[1].content;
            messages.shift();
        }

        try {
            const response = await fetch(this.getEndpoint(), {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(this.buildRequestBody(messages)),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API 请求失败 (${response.status}): ${error}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') continue;

                    let data;
                    if (line.startsWith('data: ')) {
                        try {
                            data = JSON.parse(line.slice(6));
                        } catch {
                            continue;
                        }
                    } else {
                        continue;
                    }

                    // OpenAI 格式
                    let content = '';
                    if (data.choices && data.choices[0]) {
                        const choice = data.choices[0];
                        if (choice.delta && choice.delta.content) {
                            content = choice.delta.content;
                        }
                    }
                    // Claude 格式
                    else if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                        content = data.delta.text;
                    }
                    else if (data.delta && data.delta.text) {
                        content = data.delta.text;
                    }

                    if (content) {
                        fullContent += content;
                        onChunk(content, fullContent);
                    }
                }
            }

            onComplete(fullContent);
        } catch (err) {
            if (err.name === 'AbortError') {
                onError(new Error('审核已取消'));
            } else {
                onError(err);
            }
        }
    },

    /**
     * 发送聊天消息
     * @param {Array} messages - 消息历史
     * @param {Function} onChunk
     * @param {Function} onComplete
     * @param {Function} onError
     */
    async chat(messages, onChunk, onComplete, onError) {
        if (!this.config || !this.config.apiKey) {
            onError(new Error('请先配置 API Key'));
            return;
        }

        this.abortController = new AbortController();

        // Claude 格式调整
        let apiMessages = [...messages];
        if (this.config.provider === 'claude') {
            // 合并 system 到第一个 user
            const systemMsg = apiMessages.find(m => m.role === 'system');
            if (systemMsg) {
                const firstUserIdx = apiMessages.findIndex(m => m.role === 'user');
                if (firstUserIdx >= 0) {
                    apiMessages[firstUserIdx].content = systemMsg.content + '\n\n' + apiMessages[firstUserIdx].content;
                }
                apiMessages = apiMessages.filter(m => m.role !== 'system');
            }
        }

        try {
            const response = await fetch(this.getEndpoint(), {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(this.buildRequestBody(apiMessages)),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API 请求失败 (${response.status}): ${error}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') continue;

                    let data;
                    if (line.startsWith('data: ')) {
                        try {
                            data = JSON.parse(line.slice(6));
                        } catch {
                            continue;
                        }
                    } else {
                        continue;
                    }

                    let content = '';
                    if (data.choices && data.choices[0]) {
                        const choice = data.choices[0];
                        if (choice.delta && choice.delta.content) {
                            content = choice.delta.content;
                        }
                    }
                    else if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                        content = data.delta.text;
                    }
                    else if (data.delta && data.delta.text) {
                        content = data.delta.text;
                    }

                    if (content) {
                        fullContent += content;
                        onChunk(content, fullContent);
                    }
                }
            }

            onComplete(fullContent);
        } catch (err) {
            if (err.name === 'AbortError') {
                onError(new Error('请求已取消'));
            } else {
                onError(err);
            }
        }
    },

    /**
     * 取消当前请求
     */
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    },

    /**
     * 将 Markdown 文本转换为 HTML
     * @param {string} markdown
     * @returns {string}
     */
    markdownToHtml(markdown) {
        if (typeof marked !== 'undefined') {
            return marked.parse(markdown);
        }
        // 简单的 fallback
        return markdown
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- (.*)/g, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }
};
