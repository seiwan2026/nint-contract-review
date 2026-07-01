/**
 * 文件解析模块
 * 支持 .docx (mammoth.js) 和 .pdf (pdf.js) 格式
 */

const FileParser = {
    /**
     * 根据文件扩展名解析文件
     * @param {File} file - 上传的文件对象
     * @returns {Promise<{html: string, text: string}>}
     */
    async parse(file) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'docx') {
            return this.parseDocx(file);
        } else if (ext === 'pdf') {
            return this.parsePdf(file);
        } else {
            throw new Error(`不支持的文件格式: .${ext}，请上传 .docx 或 .pdf 文件`);
        }
    },

    /**
     * 解析 .docx 文件
     * @param {File} file
     * @returns {Promise<{html: string, text: string}>}
     */
    async parseDocx(file) {
        const arrayBuffer = await file.arrayBuffer();

        const result = await mammoth.convertToHtml({ arrayBuffer }, {
            styleMap: [
                "p[style-name='Heading 1'] => h1",
                "p[style-name='Heading 2'] => h2",
                "p[style-name='Heading 3'] => h3",
                "p[style-name='Heading 4'] => h4",
                "b => strong",
                "i => em",
            ]
        });

        // 清理 HTML，移除空段落
        let html = result.value;
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>&nbsp;<\/p>/g, '');

        // 提取纯文本
        const text = this.htmlToText(html);

        return { html, text };
    },

    /**
     * 解析 .pdf 文件（文字型）
     * @param {File} file
     * @returns {Promise<{html: string, text: string}>}
     */
    async parsePdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        let htmlParts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // 提取文本
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            fullText += pageText + '\n\n';

            // 构建简单的 HTML
            // 根据文本特征推断段落
            const paragraphs = this.splitIntoParagraphs(pageText);
            const pageHtml = paragraphs.map(p => `<p>${this.escapeHtml(p)}</p>`).join('');
            htmlParts.push(`<div class="pdf-page" data-page="${i}">${pageHtml}</div>`);
        }

        const html = htmlParts.join('');

        return { html, text: fullText.trim() };
    },

    /**
     * 将文本分割成段落
     * @param {string} text
     * @returns {string[]}
     */
    splitIntoParagraphs(text) {
        // 按句子结束符分割，然后合并成段落
        const sentences = text.split(/([。！？.!?]\s*)/);
        const paragraphs = [];
        let currentPara = '';

        for (let i = 0; i < sentences.length; i++) {
            currentPara += sentences[i];
            // 每3-5个句子或遇到换行就分段
            if (i % 4 === 3 || sentences[i].includes('\n')) {
                if (currentPara.trim()) {
                    paragraphs.push(currentPara.trim());
                }
                currentPara = '';
            }
        }

        if (currentPara.trim()) {
            paragraphs.push(currentPara.trim());
        }

        return paragraphs.length > 0 ? paragraphs : [text];
    },

    /**
     * HTML 转纯文本
     * @param {string} html
     * @returns {string}
     */
    htmlToText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    },

    /**
     * 转义 HTML 特殊字符
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 格式化文件大小
     * @param {number} bytes
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};
