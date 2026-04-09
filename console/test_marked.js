
import { marked } from 'marked';

const text = '<b>Here is implementation guidelines:</b>\n ';
const html = marked.parse(text);
console.log('Input:', JSON.stringify(text));
console.log('Output:', JSON.stringify(html));

const text2 = '<b>Bold</b>';
console.log('Input2:', JSON.stringify(text2));
console.log('Output2:', JSON.stringify(marked.parse(text2)));
