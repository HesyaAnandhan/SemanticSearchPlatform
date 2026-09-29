const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
    const pdfBuffer = fs.readFileSync('c:\\Users\\PC\\Desktop\\SemanticSearchPlatform (3)\\SemanticSearchPlatform (3)\\SemanticSearchPlatform (2)\\SemanticSearchPlatform\\server\\uploads\\1790575836074-Marklist_NPTEL.pdf');
    const render_page = async (pageData) => {
        let render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
        }
        return pageData.getTextContent(render_options).then(function(textContent) {
            let text = '';
            for (let item of textContent.items) {
                text += item.str + ' ';
            }
            return `\n\n---PAGE_${pageData.pageIndex + 1}---\n\n` + text;
        });
    };
    
    const data = await pdfParse(pdfBuffer, { pagerender: render_page });
    console.log(data.text.substring(0, 500));
}
test();
