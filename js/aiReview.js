/**
 * AI 审核模块
 * 支持 DeepSeek、Kimi、火山引擎、硅基流动等国内大模型 API
 * 以及自定义 OpenAI 兼容接口
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
     * 获取默认审核要点
     * @returns {string}
     */
    getDefaultReviewPoints() {
        return `1. **主体信息完整性**：签约主体名称、地址、联系方式、资质是否完整准确
2. **权利义务对等性**：双方权利义务是否平衡，是否存在显失公平的条款
3. **违约责任明确性**：违约情形、违约金计算方式、赔偿范围是否清晰
4. **争议解决条款**：管辖法院/仲裁机构约定是否合理、明确
5. **隐藏风险条款**：免责条款、单方变更权、自动续约等可能损害一方利益的条款
6. **付款与交付**：金额、时间、方式、验收标准是否清晰无歧义
7. **保密与知识产权**：保密范围、期限、知识产权归属约定是否明确
8. **终止与解除**：合同终止条件、提前解除程序、善后处理是否合理`;
    },

    /**
     * 获取指定合同类型的默认审核要点
     * @param {string} contractType
     * @returns {string}
     */
    getDefaultPointsByType(contractType) {
        const templates = {
            purchase: `1. **供应商资质与授权**：确认供应商主体资格、经营范围、授权链条是否清晰有效
2. **标的物描述**：审查采购标的名称、规格、型号、数量、质量标准、验收标准是否明确
3. **价格与付款**：审查计价方式、付款节点、预付款比例、发票要求，是否存在账期风险
4. **交付与验收**：审查交付时间、地点、运输方式、验收期限、不合格品处理机制
5. **质保与售后**：审查质保期限、质保范围、维修更换责任、响应时间
6. **违约责任**：审查延迟交付、质量不合格、单方面解约等情形的违约金或赔偿约定
7. **知识产权**：审查交付物是否侵犯第三方知识产权、知识产权归属约定
8. **争议解决**：审查管辖法院/仲裁条款是否有利于我方`,

            service: `1. **服务范围与标准**：审查服务内容、交付物、质量标准、SLA 指标是否明确
2. **服务期限与里程碑**：审查服务起止时间、关键节点、延期处理机制
3. **费用与结算**：审查计费方式、付款节点、报销条款、调价机制
4. **人员安排**：审查服务团队资质、人员更换程序、关键人员锁定条款
5. **成果验收**：审查验收标准、验收流程、不合格成果的处理方式
6. **保密与数据安全**：审查保密义务、数据保护、信息安全责任
7. **知识产权**：审查服务过程中产生成果的知识产权归属
8. **违约责任**：审查双方违约责任是否对等，赔偿上限是否合理`,

            advertising: `1. **推广内容与素材**：审查投放素材的合规性、版权归属、审核流程，是否存在虚假宣传或违规风险
2. **投放平台与形式**：审查投放渠道名称、投放位、投放形式（信息流/搜索/视频等）是否明确
3. **投放时间与预算**：审查投放起止时间、日/月消耗预算上限、总预算是否明确并可控制
4. **排期与节奏**：审查投放排期表、关键节点、淡旺季调整机制
5. **KPI 与效果承诺**：审查曝光量、点击率、转化率、ROI 等核心指标约定，效果不达标的补救措施
6. **结算与对账**：审查结算周期、对账方式、返点/返货条款、发票要求
7. **数据归属与隐私**：审查投放数据（用户画像、转化数据等）的所有权归属、数据合规与个人信息保护
8. **违约与终止**：审查提前终止条件、效果不达标的违约金/补偿条款、素材下架机制`,

            lease: `1. **租赁物描述**：审查租赁物位置、面积、用途、权属状况、交付标准是否明确
2. **租赁期限**：审查起止日期、续租条件、优先承租权、合同到期处理方式
3. **租金与押金**：审查租金标准、支付方式、支付时间、押金数额及退还条件
4. **费用承担**：审查水电气、物业、取暖、维修等费用由哪方承担
5. **维修责任**：审查出租方维修义务、承租方报修程序、紧急维修处理
6. **装修与改造**：审查装修审批、费用承担、合同终止后装修归属
7. **转租与分租**：审查是否允许转租、分租，违约责任如何约定
8. **提前解约与收回**：审查单方解约条件、违约金、装修损失补偿、逾期腾退责任`,
        };
        return templates[contractType] || this.getDefaultReviewPoints();
    },

    /**
     * 获取审核立场对应的提示词片段
     * @param {string} stance
     * @returns {string}
     */
    getStanceInstructions(stance) {
        switch (stance) {
            case 'party_a':
                return `\n\n## 审核立场\n你代表**甲方（委托方 / 采购方 / 付款方）**进行审核。请重点关注：\n- 乙方履约能力和资质审查\n- 验收标准和交付物质量要求是否充分保护甲方利益\n- 付款节点是否合理（尽量后置付款条件）\n- 违约责任和赔偿条款是否充分保障甲方权益\n- 是否存在单方有利于乙方的免责条款或限制责任条款`;
            case 'party_b':
                return `\n\n## 审核立场\n你代表**乙方（被委托方 / 供应商 / 收款方）**进行审核。请重点关注：\n- 付款条件和时间是否合理（尽量缩短回款周期）\n- 验收标准是否客观可衡量，验收期限是否合理\n- 甲方的协助配合义务是否明确\n- 责任上限条款是否合理（避免无限责任）\n- 知识产权归属和使用范围是否保护乙方核心资产`;
            case 'neutral':
                return `\n\n## 审核立场\n你以**中立第三方**视角进行审核，关注合同整体公平性和双方权利义务的平衡。请指出对任一方可能显失公平的条款，并给出兼顾双方利益的修改建议。`;
            default:
                return '';
        }
    },

    /**
     * 加载审核要点（自定义或默认）
     * @returns {string}
     */
    loadReviewPoints() {
        if (this.config && this.config.reviewPoints) {
            return this.config.reviewPoints;
        }
        return this.getDefaultReviewPoints();
    },

    /**
     * 获取审核提示词
     * @param {string} customPoints - 用户自定义审核要点
     * @returns {string}
     */
    getReviewPrompt(customPoints, stance = null) {
        const points = customPoints || this.loadReviewPoints();
        const stanceInstructions = stance ? this.getStanceInstructions(stance) : '';

        return `你是一位拥有20年经验的资深法务专家，擅长合同审核与风险识别。请对以下合同进行全面审核，重点关注：

## 审核维度
${points}
${stanceInstructions}

## 输出格式要求
请按以下结构输出审核意见：

### 一、总体评估
简要评价合同整体质量、风险等级（高/中/低）

### 二、逐条审核意见
使用卡片格式输出。每条意见严格按以下 HTML 结构输出：

<div class="review-card" data-risk="高">
<div class="review-card-header">
<span class="risk-badge risk-high">高风险</span>
<span class="review-clause-ref">第X条（条款名称）</span>
</div>
<div class="review-card-body">
- **风险**：发现的问题或风险点
- **建议**：建议修改后的文本（如有）
- **依据**：相关法律依据或风险说明
</div>
</div>

注意：
- data-risk 取值：高、中、低
- risk-badge 对应 class：risk-high（红）、risk-medium（黄）、risk-low（绿）
- 条款引述用 <span class="review-clause-ref"> 包裹
- 如果某条意见没有明确条款对应，可使用 "通用条款"

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

        return {
            model: modelName,
            messages: messages,
            temperature: 0.3,
            max_tokens: 4096,
            stream: true
        };
    },

    /**
     * 获取默认模型名称
     * @param {string} provider
     * @returns {string}
     */
    getDefaultModel(provider) {
        switch (provider) {
            case 'deepseek': return 'deepseek-chat';
            case 'kimi': return 'moonshot-v1-8k';
            case 'volcano': return 'doubao-pro-32k';
            case 'siliconflow': return 'deepseek-ai/DeepSeek-V3';
            default: return 'deepseek-chat';
        }
    },

    /**
     * 获取 API 端点
     * @returns {string}
     */
    getEndpoint() {
        const { provider, customEndpoint } = this.config;
        switch (provider) {
            case 'deepseek':
                return 'https://api.deepseek.com/v1/chat/completions';
            case 'kimi':
                return 'https://api.moonshot.cn/v1/chat/completions';
            case 'volcano':
                return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
            case 'siliconflow':
                return 'https://api.siliconflow.cn/v1/chat/completions';
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
        const { apiKey } = this.config;
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
    },

    /**
     * 执行审核（流式输出）
     * @param {string} contractText
     * @param {Function} onChunk - 收到数据块时的回调
     * @param {Function} onComplete - 完成时的回调
     * @param {Function} onError - 错误时的回调
     */
    async review(contractText, onChunk, onComplete, onError, options = {}) {
        if (!this.config || !this.config.apiKey) {
            onError(new Error('请先配置 API Key'));
            return;
        }

        this.abortController = new AbortController();

        const messages = [
            { role: 'system', content: this.getReviewPrompt(options.customPoints, options.stance) },
            { role: 'user', content: `请审核以下合同内容：\n\n${contractText}` }
        ];

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

        const apiMessages = [...messages];

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
