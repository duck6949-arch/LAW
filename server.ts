import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { seedDocuments } from './src/seedData';
import { LandDocument, LandDocumentType } from './src/types';

const app = express();
const PORT = 3000;

// Body parser configuration for large files (word/pdf base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Persistent file-based document storage
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'documents.json');

let landDocuments: LandDocument[] = [];

function saveDocuments() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(landDocuments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi sao lưu tệp dữ liệu thư viện:', err);
  }
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    landDocuments = JSON.parse(fileContent);
    console.log(`Đã nạp thành công ${landDocuments.length} văn bản từ tệp lưu trữ persistent.`);
  } else {
    landDocuments = [...seedDocuments];
    saveDocuments();
    console.log(`Đã khởi tạo dữ liệu mẫu với ${landDocuments.length} văn bản vào tệp persistent.`);
  }
} catch (err) {
  console.error('Lỗi khi đọc tệp lưu trữ, chuyển sang nạp dữ liệu mẫu seedDocuments:', err);
  landDocuments = [...seedDocuments];
}

// Schema for Gemini output
const landDocumentSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Tên đầy đủ chính xác của văn bản, ví dụ: 'Thông tư số 01/2024/TT-BTNMT quy định chi tiết...'"
    },
    type: {
      type: Type.STRING,
      description: "Loại văn bản, chỉ chọn một trong các giá trị: 'Thông tư', 'Nghị định', 'Luật', hoặc 'Khác'"
    },
    abbreviation: {
      type: Type.STRING,
      description: "Số hiệu viết tắt chính thức, ví dụ: '01/2024/TT-BTNMT' hoặc '43/2014/NĐ-CP'"
    },
    issueDate: {
      type: Type.STRING,
      description: "Ngày ban hành văn bản, định dạng YYYY-MM-DD"
    },
    summary: {
      type: Type.STRING,
      description: "Tóm tắt cực kỳ ngắn gọn nội dung cốt lõi của văn bản (2-3 câu)"
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Slug định danh duy nhất ví dụ 'dieu-1', 'dieu-2'..."
          },
          title: {
            type: Type.STRING,
            description: "Tiêu đề điều khoản, ví dụ: 'Điều 1. Phạm vi điều chỉnh'"
          },
          content: {
            type: Type.STRING,
            description: "Toàn bộ nội dung chi tiết của điều khoản này. ĐẶC BIỆT LƯU Ý: Phải chèn ký tự xuống dòng '\\n' trước mỗi khoản (ví dụ dòng số '1. ', '2. ', '3. ') và trước mỗi điểm (ví dụ 'a) ', 'b) ', 'c) ' hoặc 'a. ', 'b. ', 'c. ') để phân tách chúng rõ ràng thành từng dòng riêng biệt, giúp hiển thị văn bản đẹp và không bị dính liền một mạch."
          }
        },
        required: ["id", "title", "content"]
      },
      description: "Danh sách các điều khoản (Điều 1, Điều 2...) được bóc tách từ văn bản pháp luật"
    }
  },
  required: ["title", "type", "abbreviation", "summary", "sections"]
};

// Lazy initialization of Gemini API
let aiClient: GoogleGenAI | null = null;
function getGoogleGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Hệ thống chưa cấu hình GEMINI_API_KEY. Vui lòng thêm key trong Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper function to retry Gemini content generation on failures (rate limits, etc.)
async function retryGenerateContent(ai: any, params: any, retries = 3, delay = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      console.warn(`Thử lại cuộc gọi Gemini API lần ${attempt} thất bại:`, err.message || err);
      if (attempt === retries) {
        throw err;
      }
      const waitTime = delay * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.log(`Đang đợi ${Math.round(waitTime)}ms trước khi thử lại cuộc gọi Gemini...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Utility to clean and parse Gemini JSON strings safely
function cleanAndParseJSON(text: string): any {
  if (!text) return {};
  let cleaned = text.trim();
  // Strip markdown formatting if any
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Strict JSON parse failed, attempting to isolate JSON boundaries...', err);
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const isolated = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(isolated);
      } catch (innerErr) {
        throw new Error('Phản hồi của AI không nằm trong cấu trúc JSON hợp lệ. Vui lòng thử lại.');
      }
    }
    throw err;
  }
}

// Ensure database state persists for simple operations
// REST API endpoints

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', documentsCount: landDocuments.length });
});

// GET /api/documents
app.get('/api/documents', (req, res) => {
  res.json(landDocuments);
});

// POST /api/documents (Manual creation)
app.post('/api/documents', (req, res) => {
  try {
    const { title, type, abbreviation, issueDate, summary, sections } = req.body;
    if (!title || !type || !abbreviation || !sections) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (title, type, abbreviation, sections)' });
    }

    const newDoc: LandDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title,
      type: type as LandDocumentType,
      abbreviation,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      summary: summary || 'Không có tóm tắt.',
      sections: sections.map((s: any, idx: number) => ({
        id: s.id || `sec-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        title: s.title || `Điều ${idx + 1}`,
        content: s.content || ''
      })),
      createdAt: new Date().toISOString()
    };

    landDocuments.unshift(newDoc);
    saveDocuments();
    res.status(201).json(newDoc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = landDocuments.length;
  landDocuments = landDocuments.filter(doc => doc.id !== id);
  if (landDocuments.length === initialLength) {
    return res.status(404).json({ error: 'Không tìm thấy tài liệu cần xóa' });
  }
  saveDocuments();
  res.json({ success: true, message: 'Đã xóa tài liệu thành công' });
});

// DELETE /api/documents (Delete all documents in the library)
app.delete('/api/documents', (req, res) => {
  landDocuments = [];
  saveDocuments();
  res.json({ success: true, message: 'Đã xóa toàn bộ thư viện tài liệu thành công' });
});

// Clean and format legal paragraphs, splitting merged clauses on newlines
function formatLegalContent(text: string): string {
  if (!text) return '';
  
  let rawLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let parsedLines: string[] = [];
  
  for (let line of rawLines) {
    // 1. If text extraction glued multiple paragraph clauses together, split them!
    // Example: "1. Đầu tư dự án. 2. Đăng ký nhận đất."
    // We search for a punctuation (. ? ! : or ") followed by whitespace and a clause number "1. " or "10. "
    let formatted = line.replace(/(\.|\?|\!|\:)\s+(\d+)\.\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ])/g, '$1\n$2. $3');
    
    // Split sub-bullet letters like "a) ", "b) "
    formatted = formatted.replace(/(\.|\?|\!|\:)\s+([a-zđđ]{1,2})\)\s+([a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ])/g, '$1\n$2) $3');
    
    // Split sub-bullet dashes
    formatted = formatted.replace(/(\.|\?|\!|\:)\s+(\-\s+[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ])/g, '$1\n$2');
    
    const parts = formatted.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    parsedLines.push(...parts);
  }
  
  return parsedLines.join('\n');
}

// Helper to normalize and ensure legal titles perfectly match official formats
function normalizeLegalTitle(title: string, type: string, abbreviation: string): string {
  if (!title) return '';
  let cleanedTitle = title.trim();
  
  // Clean up double spaces and trailing punctuation
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').replace(/\.$/, '');

  const typeLower = type.toLowerCase();
  const titleLower = cleanedTitle.toLowerCase();
  
  if (titleLower.startsWith(typeLower)) {
    // If it starts with the correct type (e.g. "thông tư" or "nghị định"), check if abbreviation is already included
    const abbrevClean = abbreviation.replace(/\s+/g, '').toLowerCase();
    const titleClean = cleanedTitle.replace(/\s+/g, '').toLowerCase();
    
    if (!titleClean.includes(abbrevClean)) {
      // If title doesn't display the number/abbreviation, insert "số [Abbreviation]" after the Type keyword
      const typeLen = type.length;
      let remains = cleanedTitle.substring(typeLen).trim();
      
      // Clean up repetitive starting keywords like "số:" or "số ..." in the remainder
      remains = remains.replace(/^(số\s*\:?\s*\d*[\/\d\w\-]*|quy\s*định|hướng\s*dẫn|chi\s*tiết)/i, (match) => {
        if (match.toLowerCase().startsWith('số')) return '';
        return match;
      }).trim();
      
      if (remains.length > 0) {
        remains = remains.charAt(0).toLowerCase() + remains.slice(1);
      }
      return `${type} số ${abbreviation} ${remains}`;
    }
  } else {
    // If it does not start with the correct document type, prepend it correctly
    let remains = cleanedTitle;
    if (remains.toLowerCase().startsWith('số')) {
      remains = remains.substring(2).trim();
    }
    if (remains.length > 0) {
      remains = remains.charAt(0).toLowerCase() + remains.slice(1);
    }
    return `${type} số ${abbreviation} ${remains}`;
  }
  
  return cleanedTitle;
}

// Simple rule-based local parser for Vietnamese legal text in case AI is offline / rate-limited
function parseDocumentLocally(text: string, fileName: string): LandDocument {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let title = '';
  let abbreviation = '';
  let type: LandDocumentType = 'Khác';
  const issueDate = new Date().toISOString().split('T')[0];
  
  // Clean file name to remove extension for fallback title
  const dotIdx = fileName.lastIndexOf('.');
  const nameWithoutExt = dotIdx !== -1 ? fileName.substring(0, dotIdx) : fileName;

  // 1. Rigorous abbreviation detection
  // Official number form: e.g. 01/2024/TT-BTNMT, 102/2024/NĐ-CP, 31/2024/QH15
  const abbrevRegex = /(\d+\/\d+\/[A-Z0-9ĐđĐ\-\/]+)/gi;
  for (const line of lines.slice(0, 40)) {
    const matches = line.match(abbrevRegex);
    if (matches) {
      for (const m of matches) {
        const upperMatch = m.toUpperCase();
        if (
          upperMatch.includes('/TT') || 
          upperMatch.includes('/NĐ') || 
          upperMatch.includes('/ND') || 
          upperMatch.includes('/QH') || 
          upperMatch.includes('/QĐ') || 
          upperMatch.includes('/QD')
        ) {
          abbreviation = m;
          break;
        }
      }
      if (abbreviation) break;
    }
  }

  if (!abbreviation) {
    for (const line of lines.slice(0, 25)) {
      const match = line.match(/([0-9]+\/[0-9]+\/[A-Z0-9\-\/]+)/i);
      if (match) {
        abbreviation = match[1];
        break;
      }
    }
  }

  if (!abbreviation) {
    abbreviation = nameWithoutExt.toUpperCase().substring(0, 25);
  }

  // 2. Deducing type with high structural priority
  const abbrevUpper = abbreviation.toUpperCase();
  if (abbrevUpper.includes('/TT') || abbrevUpper.includes('TT-')) {
    type = 'Thông tư';
  } else if (abbrevUpper.includes('/NĐ') || abbrevUpper.includes('/ND') || abbrevUpper.includes('NĐ-') || abbrevUpper.includes('ND-')) {
    type = 'Nghị định';
  } else if (abbrevUpper.includes('/QH') || abbrevUpper.includes('QH15') || abbrevUpper.includes('QH14') || abbrevUpper.includes('/L-')) {
    type = 'Luật';
  } else {
    // If abbreviation search is ambiguous, scan text lines for main centered title keywords (avoiding preambles like "Căn cứ...")
    let foundKeyword = false;
    for (const line of lines.slice(0, 25)) {
      const lineLower = line.toLowerCase();
      
      // We check if the line strictly starts with or is exactly the keyword
      if (lineLower.startsWith('thông tư') || lineLower.includes('thông tư số')) {
        type = 'Thông tư';
        foundKeyword = true;
        break;
      } else if (lineLower.startsWith('nghị định') || lineLower.includes('nghị định số')) {
        type = 'Nghị định';
        foundKeyword = true;
        break;
      } else if (lineLower.startsWith('luật') || lineLower.includes('luật số')) {
        // Exclude references starts with "Căn cứ" or containing referencing words
        if (!lineLower.includes('căn cứ') && !lineLower.includes('chi tiết')) {
          type = 'Luật';
          foundKeyword = true;
          break;
        }
      }
    }
    if (!foundKeyword) {
      type = 'Khác';
    }
  }

  // 3. Smart title selection & multi-line description combining
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    if (
      lineLower.startsWith('thông tư') || 
      lineLower.startsWith('nghị định') || 
      lineLower.startsWith('luật') ||
      lineLower.startsWith('quyết định')
    ) {
      // If it is a short keyword line (like "THÔNG TƯ"), combine it with subsequent description lines!
      if (line.length < 15 && i + 1 < lines.length) {
        let combinedTitle = line;
        let nextIdx = i + 1;
        while (nextIdx < Math.min(i + 5, lines.length) && lines[nextIdx].length > 0) {
          const nextLine = lines[nextIdx];
          const nextLower = nextLine.toLowerCase();
          if (
            nextLower.startsWith('căn cứ') || 
            nextLower.startsWith('số:') || 
            nextLower.startsWith('hà nội') || 
            nextLower.includes('chủ nghĩa việt nam')
          ) {
            break;
          }
          combinedTitle += ' ' + nextLine;
          nextIdx++;
        }
        title = combinedTitle;
        break;
      } else {
        title = line;
        break;
      }
    }
  }

  // Fallback title to clean line if title is still missing
  if (!title) {
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      if (
        line.length > 15 && 
        !lineLower.includes('cộng hòa') && 
        !lineLower.includes('độc lập') && 
        !lineLower.includes('bộ tài nguyên') && 
        !lineLower.includes('hà nội') &&
        !lineLower.startsWith('số:')
      ) {
        title = line;
        break;
      }
    }
  }

  if (!title) {
    title = nameWithoutExt.replace(/[-_]/g, ' ');
  }

  const sections: { id: string; title: string; content: string }[] = [];
  let currentSecTitle = 'Phần mở đầu';
  let currentSecParas: string[] = [];
  
  // Scan lines to extract "Điều X"
  const itemRegex = /^\s*Điều\s+(\d+)\s*[\.\:\-\–]?\s*(.*)$/i;

  for (const line of lines) {
    const match = line.match(itemRegex);
    if (match) {
      // Save previously accumulated section
      if (currentSecTitle !== 'Phần mở đầu' || currentSecParas.length > 0) {
        sections.push({
          id: `sec-${sections.length}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          title: currentSecTitle,
          content: formatLegalContent(currentSecParas.join('\n'))
        });
      }
      currentSecTitle = line; // Use full matched line (e.g., "Điều 1. Phạm vi điều chỉnh")
      currentSecParas = [];
    } else {
      currentSecParas.push(line);
    }
  }

  // Push final section
  if (currentSecTitle !== 'Phần mở đầu' || currentSecParas.length > 0) {
    sections.push({
      id: `sec-${sections.length}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      title: currentSecTitle,
      content: formatLegalContent(currentSecParas.join('\n'))
    });
  }

  // If no sections matched, segment into blocks of paragraphs
  if (sections.length === 0) {
    let paraIdx = 1;
    for (let i = 0; i < lines.length; i += 10) {
      const chunk = lines.slice(i, i + 10).join('\n');
      sections.push({
        id: `sec-${sections.length}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        title: `Điều ${paraIdx}. Quy định chung ${paraIdx}`,
        content: formatLegalContent(chunk)
      });
      paraIdx++;
    }
  }

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    title: normalizeLegalTitle(title, type, abbreviation),
    type,
    abbreviation,
    issueDate,
    summary: `Số hóa cấu trúc bằng thuật toán máy chủ tối ưu mới. Trích xuất và bóc tách thành công ${sections.length} điều khoản thực tế từ văn bản của bạn.`,
    sections,
    createdAt: new Date().toISOString(),
    isSimulated: true
  };
}

// Generate high-fidelity simulation template for PDF files in offline mode
function generateMockDocument(fileName: string): LandDocument {
  const dotIdx = fileName.lastIndexOf('.');
  const baseName = dotIdx !== -1 ? fileName.substring(0, dotIdx) : fileName;
  const abbreviation = baseName.toUpperCase().substring(0, 20);
  
  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    title: `Phân tích cấu trúc: ${baseName}`,
    type: fileName.toLowerCase().includes('thong tu') ? 'Thông tư' : fileName.toLowerCase().includes('nghi dinh') ? 'Nghị định' : 'Luật',
    abbreviation: abbreviation || 'HDK-PD',
    issueDate: new Date().toISOString().split('T')[0],
    summary: `Hồ sơ PDF "${fileName}" đã được phân định cấu trúc ngoại tuyến thành công bằng công nghệ máy chủ (Bản giả cấu trúc phục vụ tra cứu). Hệ thống tự động bóc tách các điều khoản của tài liệu.`,
    sections: [
      {
        id: `sec-1-${Date.now()}`,
        title: 'Điều 1. Phạm vi áp dụng phân tích đất đai',
        content: '1. Hồ sơ này quy định phạm vi điều chỉnh đối với các hoạt động giao đất, thuê đất, cho phép chuyển đổi mục đích sử dụng các nhóm đất nông nghiệp.\n2. Các đối tượng được áp dụng bao gồm:\n  a) Cơ quan nhà nước có quyền hạn phê duyệt đất đai;\n  b) Cá nhân, hộ gia đình đang trực tiếp canh tác nông nghiệp hoặc có quyền sở hữu hợp pháp tài sản gắn liền.'
      },
      {
        id: `sec-2-${Date.now()}`,
        title: 'Điều 2. Nguyên tắc bồi hoàn và hỗ trợ tái định cư',
        content: '1. Việc bồi hoàn tài sản đất đai bị giải tỏa phải bảo đảm tính công khai, công bằng, đúng thời hạn quy định pháp luật sở tại.\n2. Các phương án thực hiện hỗ trợ đời sống bao gồm:\n  a) Chi trả tiền đền bù trực tiếp theo khung giá quy định;\n  b) Cấp nhà ở xã hội hoặc nền đất ở khu tái định cư tập trung;\n  c) Hỗ trợ đào tạo chuyển đổi nghề nghiệp cho lao động địa phương.'
      },
      {
        id: `sec-3-${Date.now()}`,
        title: 'Điều 3. Thẩm quyền quyết định giao đất, cho thuê đất',
        content: '1. Ủy ban nhân dân cấp tỉnh quyết định giao đất, cho thuê đất, cho phép chuyển mục đích sử dụng đất đối với tổ chức, cơ sở tôn giáo, người Việt Nam định cư ở nước ngoài.\n2. Ủy ban nhân dân cấp huyện quyết định giao đất, cho thuê đất đối với hộ gia đình, cá nhân.'
      }
    ],
    createdAt: new Date().toISOString(),
    isSimulated: true
  };
}

// Extract sequential readable text strings (UTF-16LE and ASCII fallback) from binary MS Word .doc file
function extractTextFromBinaryDoc(buffer: Buffer): string {
  let resultText = '';
  let i = 0;
  const len = buffer.length;
  
  // High-fidelity sweep for UTF-16LE sequence (main text stream of Microsoft .doc binaries)
  let currentString = '';
  
  while (i < len - 1) {
    const charCode = buffer.readUInt16LE(i);
    const isVietnameseUnicode = 
      (charCode >= 32 && charCode <= 126) || // Basic ASCII printables
      charCode === 10 || charCode === 13 || charCode === 9 || // Whitespace & formatting
      (charCode >= 0xC0 && charCode <= 0x024F) || // Latin-1 & Extended Latin
      (charCode >= 0x1EA0 && charCode <= 0x1EF9); // Vietnamese accented characters
      
    if (isVietnameseUnicode) {
      currentString += String.fromCharCode(charCode);
      i += 2;
    } else {
      if (currentString.length >= 4) {
        resultText += currentString + '\n';
      }
      currentString = '';
      i += 1; // Slide one byte forward to catch any misaligned blocks
    }
  }
  if (currentString.length >= 4) {
    resultText += currentString + '\n';
  }
  
  // 8-bit ASCII plain-text fallback sweep
  let asciiText = '';
  for (let j = 0; j < len; j++) {
    const b = buffer[j];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9 || b >= 192) {
      asciiText += String.fromCharCode(b);
    } else {
      if (asciiText.length >= 10) {
        resultText += '\n' + asciiText + '\n';
      }
      asciiText = '';
    }
  }
  
  // Filter out binary formatting headers and boilerplate metadata
  const lines = resultText.split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => {
      if (line.length < 5) return false;
      const lower = line.toLowerCase();
      if (lower.includes('microsoft word') || lower.includes('msword') || lower.includes('worddocument')) return false;
      if (lower.startsWith('bjbj') || lower.startsWith('jbjb') || lower.startsWith('normal.dotm')) return false;
      if (/^[^\w\s\u00C0-\u1EF9]{3,}$/.test(line)) return false; // purely symbols
      return true;
    });

  // Unique sequential line deduplication
  const uniqueLines: string[] = [];
  for (const line of lines) {
    if (uniqueLines.length === 0 || uniqueLines[uniqueLines.length - 1] !== line) {
      uniqueLines.push(line);
    }
  }
  
  return uniqueLines.join('\n');
}

// POST /api/parse-document (Upload & Parse PDF/Word with hybrid local-AI architecture, always successful)
app.post('/api/parse-document', async (req, res) => {
  try {
    const { fileName, mimeType, base64 } = req.body;

    if (!base64 || !mimeType) {
      return res.status(400).json({ error: 'Thiếu dữ liệu tệp (base64 hoặc mimeType)' });
    }

    let textToParse = '';
    const fnLower = fileName?.toLowerCase() || '';
    const mtLower = mimeType?.toLowerCase() || '';
    const isDocx = mtLower.includes('officedocument') || fnLower.endsWith('.docx');
    const isPdf = mtLower.includes('pdf') || fnLower.endsWith('.pdf');
    const isDoc = mtLower.includes('msword') || fnLower.endsWith('.doc');

    if (isDocx) {
      const buffer = Buffer.from(base64, 'base64');
      const mammothResult = await mammoth.extractRawText({ buffer });
      textToParse = mammothResult.value;
    } else if (isPdf) {
      const buffer = Buffer.from(base64, 'base64');
      const pdfData = await pdf(buffer);
      textToParse = pdfData.text;
    } else if (isDoc) {
      const buffer = Buffer.from(base64, 'base64');
      textToParse = extractTextFromBinaryDoc(buffer);
    } else {
      return res.status(400).json({ error: 'Chỉ hỗ trợ định dạng PDF (.pdf), Word (.docx) hoặc Word (.doc) thời kỳ cũ.' });
    }

    if (!textToParse || !textToParse.trim()) {
      return res.status(400).json({ error: 'Không thể trích xuất nội dung văn bản từ tệp này.' });
    }

    // 1. Perform core parsing locally to extract 100% of actual document text and sections
    const parsedDocument = parseDocumentLocally(textToParse, fileName);

    // 2. AI metadata enrichment: make a quick, safe, lightweight Gemini call for summary and abbreviation
    let hasAIEnrichment = false;
    try {
      const ai = getGoogleGenAI();
      const metadataSchema = {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Tên đầy đủ chính xác nhất của văn bản pháp lý đang tải lên. Tuyệt đối không lấy nhầm tên các luật được nhắc tới dưới dạng mẫu câu Căn cứ (ví dụ 'Căn cứ Luật Đất đai...'). Ví dụ đúng: 'Nghị định số 102/2024/NĐ-CP quy định chi tiết thi hành một số điều Luật Đất đai'"
          },
          type: {
            type: Type.STRING,
            description: "Phân loại chuẩn xác loại văn bản này, chỉ chọn một trong các giá trị: 'Thông tư', 'Nghị định', 'Luật', hoặc 'Khác'."
          },
          abbreviation: {
            type: Type.STRING,
            description: "Số hiệu viết tắt đầy đủ chuẩn xác nhất của chính văn bản này, ví dụ: '102/2024/NĐ-CP' hoặc '01/2024/TT-BTNMT'. Không lấy nhầm số hiệu của luật tham chiếu."
          },
          issueDate: {
            type: Type.STRING,
            description: "Ngày ban hành dưới dạng YYYY-MM-DD"
          },
          summary: {
            type: Type.STRING,
            description: "Tóm tắt ngắn gọn mục đích thực tế và điểm cốt lõi của văn bản (2-3 câu)"
          }
        },
        required: ["title", "type", "abbreviation", "summary"]
      };

      // Extract raw metadata portion of text (first 10,000 chars) to keep token size tiny and lightning fast
      const previewText = textToParse.substring(0, 10000);

      const response = await retryGenerateContent(ai, {
        model: 'gemini-3.5-flash',
        contents: [
          `Hãy đọc phần trích đầu tiên của văn bản pháp luật sau đây và trích xuất thông tin cấu trúc chuẩn xác:
${previewText}`
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: metadataSchema,
          systemInstruction: 'Bạn là một chuyên gia lập pháp Việt Nam xuất sắc. Hãy phân tích trích đoạn đầu tiên của tài liệu tải lên để tìm ra: 1) Tên đầy đủ chính xác nhất của văn bản (tiêu đề), 2) Loại văn bản, 3) Số hiệu viết tắt chuẩn của chính văn bản đó, 4) Ngày ký ban hành và tóm tắt ngắn. ĐẶC BIỆT LƯU Ý CHỐNG NHẦM LẪN: Các tài liệu dưới Luật thường có câu mở đầu "Căn cứ Luật Đất đai...". Tuyệt đối không được lấy tên "Luật Đất đai" hay số hiệu của Luật Đất đai (ví dụ 31/2024/QH15) làm tiêu đề hay số hiệu hay loại của tài liệu hiện tại. Tài liệu hiện tại thường có tiêu đề rõ ràng viết in hoa như "THÔNG TƯ" hoặc "NGHỊ ĐỊNH" đi kèm nội dung điều chỉnh (ví dụ: "THÔNG TƯ Quy định chi tiết thi hành một số điều..."). Hãy lấy đúng tiêu đề đó làm title.'
        }
      });

      const parsedJSON = cleanAndParseJSON(response.text || '{}');
      if (parsedJSON.title) parsedDocument.title = parsedJSON.title;
      if (parsedJSON.type) parsedDocument.type = parsedJSON.type as LandDocumentType;
      if (parsedJSON.abbreviation) parsedDocument.abbreviation = parsedJSON.abbreviation;
      if (parsedJSON.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedJSON.issueDate)) {
        parsedDocument.issueDate = parsedJSON.issueDate;
      }
      if (parsedJSON.summary) parsedDocument.summary = parsedJSON.summary;
      
      // Normalize the title format using strict standard patterns
      parsedDocument.title = normalizeLegalTitle(parsedDocument.title, parsedDocument.type, parsedDocument.abbreviation);
      
      parsedDocument.isSimulated = false; // Mark real structured parse
      hasAIEnrichment = true;
    } catch (aiErr) {
      console.warn('AI enrichment failed, utilizing high-fidelity local structural data:', aiErr);
    }

    landDocuments.unshift(parsedDocument);
    saveDocuments();

    return res.json({ 
      success: true, 
      document: parsedDocument, 
      isSimulated: !hasAIEnrichment 
    });

  } catch (err: any) {
    console.error('Core error in parsing request:', err);
    res.status(500).json({ error: err.message || 'Có lỗi xảy ra trong quá trình xử lý tài liệu.' });
  }
});

// Vite & Static file handler
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    
    // Fallback: serve index.html with Vite transformations
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(templatePath)) {
          return res.status(404).send('Không tìm thấy tệp index.html ở gốc dự án.');
        }
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
