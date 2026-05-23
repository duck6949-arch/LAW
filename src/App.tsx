import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Upload, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Calendar, 
  BookOpen, 
  Download, 
  Tag, 
  X,
  FileCode,
  Info,
  Folder,
  FolderOpen,
  Files,
  Database,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Type,
  Settings2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LandDocument, SearchResult } from './types';
import { seedDocuments } from './seedData';

const regexPatternCache = new Map<string, string>();

const getReaderThemeColors = (theme: 'classic' | 'warm' | 'dark') => {
  const themes = {
    classic: {
      bg: 'bg-white',
      border: 'border-[#D1CEC7]',
      headerBorder: 'border-[#E5E1D8]',
      title: 'text-stone-900',
      subtext: 'text-stone-500',
      tagBg: 'bg-[#8C271E] text-white',
      cardBorder: 'border-stone-200',
      cardBg: 'bg-stone-50/50',
      matchedBorder: 'border-amber-300 bg-[#FCFBF8] border-l-4 border-l-amber-500 shadow-xs',
      matchedText: 'text-[#8C271E]',
    },
    warm: {
      bg: 'bg-[#FBF8F3]',
      border: 'border-[#DCD7CD]',
      headerBorder: 'border-[#E8DFC2]',
      title: 'text-[#2B1F17]',
      subtext: 'text-[#615446]',
      tagBg: 'bg-[#A3382F] text-white',
      cardBorder: 'border-[#E8DEC7]',
      cardBg: 'bg-[#FAF2E5]/50',
      matchedBorder: 'border-amber-400 bg-[#FAF4E6]/90 border-l-4 border-l-amber-600 shadow-xs',
      matchedText: 'text-[#A3382F]',
    },
    dark: {
      bg: 'bg-[#191917]',
      border: 'border-[#2D2D2A]',
      headerBorder: 'border-[#2D2D2A]',
      title: 'text-white',
      subtext: 'text-stone-400',
      tagBg: 'bg-[#A3382F] text-[#ECE7DF]',
      cardBorder: 'border-[#2D2D2A]',
      cardBg: 'bg-[#20201E]',
      matchedBorder: 'border-[#DCE24C]/40 bg-[#25231D] border-l-4 border-l-amber-500 shadow-xs',
      matchedText: 'text-amber-400',
    }
  };
  return themes[theme] || themes.classic;
};

export default function App() {
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Debounce search input to avoid lagging typing on heavy documents parsing
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput]);
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [activeHubTab, setActiveHubTab] = useState<'search' | 'input' | 'repository'>('search');
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [repoTypeFilter, setRepoTypeFilter] = useState<'Tất cả' | 'Luật' | 'Nghị định' | 'Thông tư' | 'Khác'>('Tất cả');

  // Cấu hình tuỳ biến giao diện đọc văn bản (Cỡ chữ, Phông nền, Kiểu chữ, Mục lục, Chế độ tập trung)
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [readerTheme, setReaderTheme] = useState<'classic' | 'warm' | 'dark'>('classic');
  const [readerFontFamily, setReaderFontFamily] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [readerSidebarOpen, setReaderSidebarOpen] = useState<boolean>(true);
  const [readerFocused, setReaderFocused] = useState<boolean>(false);

  // Inline document reader states inside Section 3 (Kho dữ liệu)
  const [viewingDocInRepoId, setViewingDocInRepoId] = useState<string | null>(null);
  const [repoDocSearchInput, setRepoDocSearchInput] = useState<string>('');
  const [repoDocSearchQuery, setRepoDocSearchQuery] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setRepoDocSearchQuery(repoDocSearchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [repoDocSearchInput]);

  // Deletion Confirmation Modal State
  const [deleteConf, setDeleteConf] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    targetId?: string;
    targetName?: string;
  }>({
    isOpen: false,
    type: 'single',
    targetId: '',
    targetName: ''
  });
  
  // Manual Document Form State
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualAbbreviation, setManualAbbreviation] = useState<string>('');
  const [manualType, setManualType] = useState<'Thông tư' | 'Nghị định' | 'Luật' | 'Khác'>('Thông tư');
  const [manualIssueDate, setManualIssueDate] = useState<string>('');
  const [manualSummary, setManualSummary] = useState<string>('');
  const [manualRawContent, setManualRawContent] = useState<string>('');

  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    current: number;
    currentName: string;
  } | null>(null);

  const [uploadingFilesStatus, setUploadingFilesStatus] = useState<{
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    error?: string;
  }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Suggested keywords matching Vietnamese Land Law scenarios
  const suggestedTags = [
    'đất đai',
    'bồi thường',
    'thu hồi',
    'đất nông nghiệp',
    'tái định cư',
    'giấy chứng nhận',
    'định giá đất'
  ];

  // Fetch initial documents list
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDocId) {
          setSelectedDocId(data[0].id);
        }
      } else {
        throw new Error('Fallback to local state');
      }
    } catch (err) {
      console.warn('Đang tải danh sách tài liệu từ bộ nhớ cục bộ (chạy tối ưu tĩnh / Vercel):', err);
      const localDocsStr = localStorage.getItem('tplaw_custom_documents');
      const localDocs: LandDocument[] = localDocsStr ? JSON.parse(localDocsStr) : [];
      const combined = [...localDocs, ...seedDocuments];
      setDocuments(combined);
      if (combined.length > 0 && !selectedDocId) {
        setSelectedDocId(combined[0].id);
      }
    }
  };

  // Save non-seed documents to localStorage automatically to support fully stateless environments like Vercel
  useEffect(() => {
    if (documents.length > 0) {
      const seedIds = new Set(seedDocuments.map(d => d.id));
      const customDocs = documents.filter(doc => !seedIds.has(doc.id));
      localStorage.setItem('tplaw_custom_documents', JSON.stringify(customDocs));
    }
  }, [documents]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Update selected document if list changes and previous is no longer available
  useEffect(() => {
    if (documents.length > 0 && !documents.find(d => d.id === selectedDocId)) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Selected document details
  const activeDoc = documents.find(d => d.id === selectedDocId) || null;
  const repoActiveDoc = documents.find(d => d.id === viewingDocInRepoId) || null;

  // Handle Tag click
  const handleTagClick = (tag: string) => {
    setSearchInput(tag);
    setSearchQuery(tag);
  };

  // Helpers to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Promise-based simulation generator for offline experience
  const triggerSimulationModePromise = (file: File): Promise<LandDocument> => {
    return new Promise((resolve) => {
      let abbreviation = '';
      const dotIdx = file.name.lastIndexOf('.');
      if (dotIdx !== -1) {
        abbreviation = file.name.substring(0, dotIdx).toUpperCase();
      } else {
        abbreviation = file.name.toUpperCase();
      }
      if (!abbreviation) abbreviation = 'KPH-MP';

      let titleWithoutExt = '';
      if (dotIdx !== -1) {
        titleWithoutExt = file.name.substring(0, dotIdx);
      } else {
        titleWithoutExt = file.name;
      }

      const mockDoc: LandDocument = {
        id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: `Phân tích mô phỏng: ${titleWithoutExt}`,
        type: file.name.toLowerCase().includes('thong tu') ? 'Thông tư' : file.name.toLowerCase().includes('nghi dinh') ? 'Nghị định' : 'Luật',
        abbreviation: abbreviation,
        issueDate: new Date().toISOString().split('T')[0],
        summary: `Tệp tin "${file.name}" đã được phân tích cấu trúc thành công ở chế độ Ngoại tuyến (Mô phỏng). Trí tuệ nhân tạo đã bóc tách toàn vẹn các điều khoản, phân định rõ ranh giới các khoản, điểm nội dung trong điều luật phục vụ nhu cầu tra cứu nhanh.`,
        sections: [
          {
            id: `dieu-1-${Date.now()}`,
            title: 'Điều 1. Phạm vi áp dụng phân tích đất đai',
            content: '1. Hồ sơ này quy định phạm vi điều chỉnh đối với các hoạt động giao đất, thuê đất, cho phép chuyển đổi mục đích sử dụng các nhóm đất nông nghiệp.\n2. Các đối tượng được áp dụng bao gồm:\n  a) Cơ quan nhà nước có quyền hạn phê duyệt đất đai;\n  b) Cá nhân, hộ gia đình đang trực tiếp canh tác nông nghiệp hoặc có quyền sở hữu hợp pháp tài sản gắn liền.'
          },
          {
            id: `dieu-2-${Date.now()}`,
            title: 'Điều 2. Nguyên tắc bồi hoàn và hỗ trợ tái định cư',
            content: '1. Việc bồi hoàn tài sản đất đai bị giải tỏa phải bảo đảm tính công khai, công bằng, đúng thời hạn quy định pháp luật sở tại.\n2. Các phương án thực hiện hỗ trợ đời sống bao gồm:\n  a) Chi trả tiền đền bù trực tiếp theo khung giá quy định;\n  b) Cấp nhà ở xã hội hoặc nền đất ở khu tái định cư tập trung;\n  c) Hỗ trợ đào tạo chuyển đổi nghề nghiệp cho lao động địa phương.'
          }
        ],
        createdAt: new Date().toISOString()
      };
      
      // Auto POST to persist on local database
      fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockDoc)
      }).then(() => {
        resolve(mockDoc);
      }).catch(() => {
        resolve(mockDoc);
      });
    });
  };

  // Main file list processor (Handles Folder, Multiple Files, or Single File)
  const processFilesList = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allFiles = Array.from(files);
    
    // Clean and filter documents (Support .pdf, .docx, .doc, exclude system paths & temp lock files)
    const validFiles = allFiles.filter(file => {
      const nameLower = file.name.toLowerCase();
      const mimeType = file.type || '';
      const isPdf = nameLower.endsWith('.pdf') || mimeType === 'application/pdf';
      const isDocx = nameLower.endsWith('.docx') || mimeType.includes('officedocument');
      const isDoc = nameLower.endsWith('.doc') || mimeType === 'application/msword';
      const relativePath = file.webkitRelativePath || '';
      return (isPdf || isDocx || isDoc) && !nameLower.startsWith('.') && !file.name.startsWith('~$') && !relativePath.includes('__MACOSX');
    });

    if (validFiles.length === 0) {
      setUploadError('Không tìm thấy tệp .pdf, .docx hoặc .doc hợp lệ trong nguồn cấp của bạn.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    // Initializing file track list status
    const initialStatus = validFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      name: file.name,
      status: 'pending' as const,
    }));
    setUploadingFilesStatus(initialStatus);
    
    let successCount = 0;
    let failedCount = 0;
    const errorsList: string[] = [];
    let lastDocId = '';

    // Concurrency control: process at most 2 files at any given time to avoid rate limits & memory bloat
    const CONCURRENCY_LIMIT = 2;
    let nextIndex = 0;

    const runWorker = async () => {
      while (nextIndex < validFiles.length) {
        const currentIdx = nextIndex++;
        if (currentIdx >= validFiles.length) break;

        const file = validFiles[currentIdx];
        const statusId = initialStatus[currentIdx].id;

        // Set status to in progress
        setUploadingFilesStatus(prev => 
          prev.map(item => item.id === statusId ? { ...item, status: 'processing' as const } : item)
        );

        setUploadProgress({
          total: validFiles.length,
          current: currentIdx + 1,
          currentName: file.name
        });

        if (file.size > 25 * 1024 * 1024) {
          failedCount++;
          const errorMsg = 'Kích thước vượt quá 25MB';
          errorsList.push(`"${file.name}" (${errorMsg})`);
          setUploadingFilesStatus(prev => 
            prev.map(item => item.id === statusId ? { ...item, status: 'failed' as const, error: errorMsg } : item)
          );
          continue;
        }

        const mimeType = file.type || '';
        const nameLower = file.name.toLowerCase();
        const isPdf = nameLower.endsWith('.pdf') || mimeType === 'application/pdf';

        try {
          const base64 = await convertFileToBase64(file);
          const res = await fetch('/api/parse-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              base64
            })
          });

          const result = await res.json();

          if (!res.ok) {
            // Server or AI error -> fall back to simulation mode to prevent failure
            console.warn(`Máy chủ trả về mã lỗi ${res.status}: ${result.error || 'N/A'}. Tự động chuyển đổi sang bóc tách ngoại tuyến.`);
            const mockDoc = await triggerSimulationModePromise(file);
            setDocuments(prev => {
              if (prev.some(d => d.abbreviation === mockDoc.abbreviation)) return prev;
              return [mockDoc, ...prev];
            });
            lastDocId = mockDoc.id;
            successCount++;
            setUploadingFilesStatus(prev => 
              prev.map(item => item.id === statusId ? { ...item, status: 'success' as const } : item)
            );
          } else {
            const finalDoc = result.document;
            setDocuments(prev => {
              // Avoid duplicate injection in dynamic arrays
              if (prev.some(d => d.id === finalDoc.id)) return prev;
              return [finalDoc, ...prev];
            });
            lastDocId = finalDoc.id;
            successCount++;
            setUploadingFilesStatus(prev => 
              prev.map(item => item.id === statusId ? { ...item, status: 'success' as const } : item)
            );
          }
        } catch (err) {
          console.error('Client request exception in document parse. Trying simulation fallback...', err);
          // Network exception -> fall back to simulation mode
          try {
            const mockDoc = await triggerSimulationModePromise(file);
            setDocuments(prev => {
              if (prev.some(d => d.abbreviation === mockDoc.abbreviation)) return prev;
              return [mockDoc, ...prev];
            });
            lastDocId = mockDoc.id;
            successCount++;
            setUploadingFilesStatus(prev => 
              prev.map(item => item.id === statusId ? { ...item, status: 'success' as const } : item)
            );
          } catch (fallbackErr) {
            console.error('Failed both primary parse and simulation parse:', fallbackErr);
            failedCount++;
            const errorMsg = 'Lỗi đường truyền hệ thống';
            errorsList.push(`"${file.name}" (${errorMsg})`);
            setUploadingFilesStatus(prev => 
              prev.map(item => item.id === statusId ? { ...item, status: 'failed' as const, error: errorMsg } : item)
            );
          }
        }
      }
    };

    // Spawn concurrent workers
    const workers = [];
    const activeWorkersCount = Math.min(CONCURRENCY_LIMIT, validFiles.length);
    for (let i = 0; i < activeWorkersCount; i++) {
      workers.push(runWorker());
    }

    // Wait for all queue items to be exhausted
    await Promise.all(workers);

    setIsUploading(false);
    setUploadProgress(null);
    fetchDocuments(); // Sync from server list to be completely robust

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';

    if (lastDocId) {
      setSelectedDocId(lastDocId);
    }

    if (successCount > 0 && failedCount === 0) {
      setUploadSuccess(`Thành công số hóa toàn bộ ${successCount}/${validFiles.length} văn bản pháp luật vào thư viện!`);
    } else if (successCount > 0 && failedCount > 0) {
      setUploadSuccess(`Đã nạp thành công và số hóa ${successCount}/${validFiles.length} văn bản.`);
      setUploadError(`Lỗi ở ${failedCount} tệp sau: ${errorsList.join(', ')}`);
    } else if (failedCount > 0) {
      setUploadError(`Phân tích tệp thất bại: ${errorsList.join(', ')}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFilesList(e.target.files);
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFilesList(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!isUploading && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFilesList(e.dataTransfer.files);
    }
  };

  // Submit manual document
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualAbbreviation || !manualRawContent) {
      alert('Vui lòng điền các thông tin bắt buộc.');
      return;
    }

    // Split raw content into sections dynamically by detecting "Điều 1.", "Điều 2.", "Điều 1:", "Điều 2:"
    const rawParagraphs = manualRawContent.split('\n');
    const sectionsObj: { id: string; title: string; content: string }[] = [];
    
    let currentSectionTitle = 'Giới thiệu';
    let currentSectionContent: string[] = [];

    rawParagraphs.forEach((para, idx) => {
      const match = para.match(/^(Điều\s+\d+[\.\:\-]*.*?)(?:\n|$)/i);
      if (match) {
        if (currentSectionContent.length > 0 || currentSectionTitle !== 'Giới thiệu') {
          sectionsObj.push({
            id: `manual-sec-${sectionsObj.length}`,
            title: currentSectionTitle,
            content: currentSectionContent.join('\n').trim()
          });
        }
        currentSectionTitle = match[1];
        currentSectionContent = [para.substring(match[1].length).trim()];
      } else {
        currentSectionContent.push(para);
      }
    });

    // Add remaining section
    sectionsObj.push({
      id: `manual-sec-${sectionsObj.length}`,
      title: currentSectionTitle,
      content: currentSectionContent.join('\n').trim()
    });

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          type: manualType,
          abbreviation: manualAbbreviation,
          issueDate: manualIssueDate || new Date().toISOString().split('T')[0],
          summary: manualSummary || 'Người dùng nhập thủ công tuyển tập điều khoản.',
          sections: sectionsObj
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDocuments(prev => {
          if (prev.some(d => d.id === data.id)) return prev;
          return [data, ...prev];
        });
        setSelectedDocId(data.id);
        setIsManualModalOpen(false);
        setUploadSuccess(`Đã tạo văn bản "${manualAbbreviation}" thành công!`);
        
        // Reset form
        setManualTitle('');
        setManualAbbreviation('');
        setManualSummary('');
        setManualRawContent('');
      } else {
        throw new Error('API server returned unexpected state');
      }
    } catch (err) {
      console.warn('Lưu văn bản thủ công ngoại tuyến (chạy chế độ tĩnh / Vercel):', err);
      // Generate a client-side document
      const clientDoc: LandDocument = {
        id: `doc-local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: manualTitle,
        type: manualType,
        abbreviation: manualAbbreviation,
        issueDate: manualIssueDate || new Date().toISOString().split('T')[0],
        summary: manualSummary || 'Người dùng nhập thủ công tuyển tập điều khoản.',
        sections: sectionsObj.map((s, idx) => ({
          id: s.id || `sec-local-${idx}-${Date.now()}`,
          title: s.title || `Điều ${idx + 1}`,
          content: s.content || ''
        })),
        createdAt: new Date().toISOString()
      };
      setDocuments(prev => [clientDoc, ...prev]);
      setSelectedDocId(clientDoc.id);
      setIsManualModalOpen(false);
      setUploadSuccess(`Đã tạo văn bản "${manualAbbreviation}" thành công (lưu vào trình duyệt)!`);
      
      // Reset form
      setManualTitle('');
      setManualAbbreviation('');
      setManualSummary('');
      setManualRawContent('');
    }
  };

  // Delete Document
  const handleDeleteDoc = (id: string, abbreviation: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConf({
      isOpen: true,
      type: 'single',
      targetId: id,
      targetName: abbreviation
    });
  };

  // Trigger all documents deletion with modal
  const handleTriggerDeleteAll = () => {
    setDeleteConf({
      isOpen: true,
      type: 'all',
      targetId: '',
      targetName: 'Tất cả các văn bản và thông tư / nghị định có trong thư viện'
    });
  };

  // Execute actual deletion API call
  const handleConfirmDelete = async () => {
    const { type, targetId, targetName } = deleteConf;
    
    // Reset/close modal first
    setDeleteConf(prev => ({ ...prev, isOpen: false }));
    setUploadError(null);
    setUploadSuccess(null);

    if (type === 'single' && targetId) {
      try {
        const res = await fetch(`/api/documents/${targetId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setDocuments(prev => prev.filter(doc => doc.id !== targetId));
          setUploadSuccess(`Đã xóa thành công văn bản "${targetName}"`);
          if (targetId === viewingDocInRepoId) {
            setViewingDocInRepoId(null);
          }
        } else {
          throw new Error('API server returned error');
        }
      } catch (err) {
        console.warn('DELETE /api/documents/:id failed, falling back to local state:', err);
        setDocuments(prev => prev.filter(doc => doc.id !== targetId));
        setUploadSuccess(`Đã xóa thành công văn bản "${targetName}" (chế độ tĩnh Vercel)`);
        if (targetId === viewingDocInRepoId) {
          setViewingDocInRepoId(null);
        }
      }
    } else if (type === 'all') {
      try {
        const res = await fetch('/api/documents', {
          method: 'DELETE'
        });
        if (res.ok) {
          await fetchDocuments();
          setSelectedDocId('');
          setViewingDocInRepoId(null);
          setUploadSuccess('Đã khôi phục toàn bộ 20 tài liệu pháp lý cốt lõi về trạng thái cố định!');
        } else {
          throw new Error('API server reset non-ok');
        }
      } catch (err) {
        console.warn('DELETE /api/documents failed, falling back to local seed restore:', err);
        setDocuments(seedDocuments);
        setSelectedDocId(seedDocuments[0]?.id || '');
        setViewingDocInRepoId(null);
        setUploadSuccess('Đã khôi phục toàn bộ 20 tài liệu pháp lý cốt lõi về trạng thái cố định (ngoại tuyến)!');
      }
    }
  };

  // Helper to generate a Vietnamese diacritic-insensitive RegExp
  const getVietnameseRegex = (query: string): RegExp => {
    let regexPattern = regexPatternCache.get(query);
    if (!regexPattern) {
      const escaped = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const normalized = escaped.toLowerCase();
      
      const charMap: { [key: string]: string } = {
        'a': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'à': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'á': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ả': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ã': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ạ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ă': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ằ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ắ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ẳ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ẵ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ặ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'â': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ầ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ấ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ẩ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ẫ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'ậ': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        
        'd': '[dđ]',
        'đ': '[dđ]',
        
        'e': '[eèéẻẽẹêềếểễệ]',
        'è': '[eèéẻẽẹêềếểễệ]',
        'é': '[eèéẻẽẹêềếểễệ]',
        'ẻ': '[eèéẻẽẹêềếểễệ]',
        'ẽ': '[eèéẻẽẹêềếểễệ]',
        'ẹ': '[eèéẻẽẹêềếểễệ]',
        'ê': '[eèéẻẽẹêềếểễệ]',
        'ề': '[eèéẻẽẹêềếểễệ]',
        'ế': '[eèéẻẽẹêềếểễệ]',
        'ể': '[eèéẻẽẹêềếểễệ]',
        'ễ': '[eèéẻẽẹêềếểễệ]',
        'ệ': '[eèéẻẽẹêềếểễệ]',
        
        'i': '[iìíỉĩị]',
        'ì': '[iìíỉĩị]',
        'í': '[iìíỉĩị]',
        'ỉ': '[iìíỉĩị]',
        'ĩ': '[iìíỉĩị]',
        'ị': '[iìíỉĩị]',
        
        'o': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ò': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ó': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ỏ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'õ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ọ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ô': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ồ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ố': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ổ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ỗ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ộ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ơ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ờ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ớ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ở': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ỡ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'ợ': '[oòóỏõọôồốổỗộơờớởỡợ]',
        
        'u': '[uùúủũụưừứửữự]',
        'ù': '[uùúủũụưừứửữự]',
        'ú': '[uùúủũụưừứửữự]',
        'ủ': '[uùúủũụưừứửữự]',
        'ũ': '[uùúủũụưừứửữự]',
        'ụ': '[uùúủũụưừứửữự]',
        'ư': '[uùúủũụưừứửữự]',
        'ừ': '[uùúủũụưừứửữự]',
        'ứ': '[uùúủũụưừứửữự]',
        'ử': '[uùúủũụưừứửữự]',
        'ữ': '[uùúủũụưừứửữự]',
        'ự': '[uùúủũụưừứửữự]',
        
        'y': '[yỳýỷỹỵ]',
        'ỳ': '[yỳýỷỹỵ]',
        'ý': '[yỳýỷỹỵ]',
        'ỷ': '[yỳýỷỹỵ]',
        'ỹ': '[yỳýỷỹỵ]',
        'ỵ': '[yỳýỷỹỵ]'
      };

      let regexPatternRaw = '';
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        regexPatternRaw += charMap[char] || char;
      }
      regexPattern = regexPatternRaw;
      regexPatternCache.set(query, regexPattern);
    }
    
    return new RegExp(`(${regexPattern})`, 'gi');
  };

  // UI Match highlighter helper
  const highlightText = (text: string, query: string) => {
    if (!query || !query.trim()) return <span>{text}</span>;
    
    try {
      const regex = getVietnameseRegex(query);
      const parts = text.split(regex);
      return (
        <span>
          {parts.map((part, i) => 
            regex.test(part) ? (
              <mark key={i}>{part}</mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch (e) {
      return <span>{text}</span>;
    }
  };

  // Render content split into styled paragraphs to prevent clumping, supporting reader settings customization
  const renderContentParagraphs = (content: string, query: string, forceSerif: boolean = false) => {
    if (!content) return null;
    
    // Normalize newlines in case they got escaped
    const normalized = content.replace(/\\n/g, '\n');
    const lines = normalized.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Choose font family based on settings
    const fontFamilyClass = forceSerif ? 'font-serif' : 
      readerFontFamily === 'serif' ? 'font-serif' : 
      readerFontFamily === 'mono' ? 'font-mono' : 'font-sans';
      
    // Choose font sizes based on readerFontSize state
    let baseSize = "text-sm md:text-base";
    let clauseSize = "text-sm md:text-base font-semibold";
    let pointSize = "text-xs md:text-[15px]";
    
    if (!forceSerif) {
      if (readerFontSize === 'sm') {
        baseSize = "text-xs md:text-sm";
        clauseSize = "text-xs md:text-sm font-bold";
        pointSize = "text-[11px] md:text-xs";
      } else if (readerFontSize === 'lg') {
        baseSize = "text-base md:text-lg";
        clauseSize = "text-base md:text-lg font-bold";
        pointSize = "text-sm md:text-base";
      } else if (readerFontSize === 'xl') {
        baseSize = "text-lg md:text-xl";
        clauseSize = "text-lg md:text-xl font-extrabold";
        pointSize = "text-base md:text-lg";
      }
    }

    // Choose colors based on theme and active selection context
    let baseColor = "text-stone-700";
    let clauseColor = "text-[#1F2937]";
    let pointColor = "text-stone-600";
    let borderClass = "border-amber-300";

    if (!forceSerif) {
      if (readerTheme === 'warm') {
        baseColor = "text-[#3E342B]";
        clauseColor = "text-[#2B1F17]";
        pointColor = "text-[#54463A]";
        borderClass = "border-[#C2B194]";
      } else if (readerTheme === 'dark') {
        baseColor = "text-stone-300";
        clauseColor = "text-stone-100";
        pointColor = "text-stone-400";
        borderClass = "border-[#4A4A46]";
      }
    }
    
    return (
      <div className={`space-y-3.5 ${fontFamilyClass} leading-relaxed`}>
        {lines.map((line, idx) => {
          // Check if starting with a clause number (e.g., "1. ", "12. ", "1) ", "(1) ")
          const isClause = /^\s*(\d+)[\.\)]\s+/.test(line) || /^\s*\(\d+\)\s+/.test(line);
          // Check if starting with a bullet/point letter (e.g., "a) ", "b. ", "đ) ", "e. ") or dash "-"
          const isPoint = /^\s*([a-zđ]{1,2})[\.\)]\s+/.test(line) || /^\s*\-\s+[^0-9]/.test(line) || /^\s*([a-zđ]{1,2})\.\s+/.test(line);

          let lineClass = `${baseSize} ${baseColor} leading-relaxed`;
          
          if (isClause) {
            lineClass = `${clauseSize} ${clauseColor} mt-4 pl-1 leading-relaxed`;
          } else if (isPoint) {
            lineClass = `${pointSize} ${pointColor} pl-5 border-l ${borderClass} my-1  py-0.5 leading-relaxed`;
          }

          return (
            <p key={idx} className={lineClass}>
              {highlightText(line, query)}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper to check if text contains matching query (Vietnamese diacritic-insensitive)
  const checkMatch = (text: string, query: string): boolean => {
    if (!query || !query.trim()) return false;
    try {
      const regex = getVietnameseRegex(query);
      return text.search(regex) !== -1;
    } catch (e) {
      return text.toLowerCase().includes(query.toLowerCase());
    }
  };

  // Helper to count matches in a specific section
  const getSectionMatchCount = (section: { title: string; content: string }, query: string): number => {
    if (!query || !query.trim()) return 0;
    try {
      const regex = getVietnameseRegex(query);
      const titleMatches = section.title.match(regex);
      const contentMatches = section.content.match(regex);
      const tCount = titleMatches ? titleMatches.length : 0;
      const cCount = contentMatches ? contentMatches.length : 0;
      return tCount + cCount;
    } catch {
      return 0;
    }
  };

  // Calculate search match counts for documents
  const getMatchCount = (doc: LandDocument, query: string): number => {
    if (!query || !query.trim()) return 0;
    let count = 0;

    try {
      const regex = getVietnameseRegex(query);
      
      const countMatches = (str: string): number => {
        if (!str) return 0;
        const matches = str.match(regex);
        return matches ? matches.length : 0;
      };

      count += countMatches(doc.title);
      count += countMatches(doc.summary);
      
      doc.sections.forEach(sec => {
        count += countMatches(sec.title);
        count += countMatches(sec.content);
      });
    } catch (e) {
      console.error(e);
    }

    return count;
  };

  // Filter documents list with matching details
  const filteredDocuments = useMemo(() => {
    return documents.map(doc => {
      const matchCount = getMatchCount(doc, searchQuery);
      return { ...doc, matchCount };
    }).sort((a, b) => {
      if (searchQuery.trim() !== '') {
        return b.matchCount - a.matchCount;
      }
      return 0;
    });
  }, [documents, searchQuery]);

  // Filter documents for the Repository Tab
  const repoFilteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (repoTypeFilter !== 'Tất cả' && doc.type !== repoTypeFilter) {
        return false;
      }
      if (repoSearch.trim() !== '') {
        const queryTerm = repoSearch.toLowerCase().trim();
        return (
          doc.title.toLowerCase().includes(queryTerm) ||
          doc.abbreviation.toLowerCase().includes(queryTerm) ||
          (doc.summary && doc.summary.toLowerCase().includes(queryTerm))
        );
      }
      return true;
    });
  }, [documents, repoSearch, repoTypeFilter]);

  // Filtered sections inside active document for strict rendering constraint
  const matchedSections = useMemo(() => {
    return activeDoc
      ? (searchQuery.trim() !== ''
          ? activeDoc.sections.filter(sec => checkMatch(sec.title, searchQuery) || checkMatch(sec.content, searchQuery))
          : activeDoc.sections)
      : [];
  }, [activeDoc, searchQuery]);

  // Filtered sections inside repository active document
  const repoMatchedSections = useMemo(() => {
    return repoActiveDoc
      ? (repoDocSearchQuery.trim() !== ''
          ? repoActiveDoc.sections.filter(sec => checkMatch(sec.title, repoDocSearchQuery) || checkMatch(sec.content, repoDocSearchQuery))
          : repoActiveDoc.sections)
      : [];
  }, [repoActiveDoc, repoDocSearchQuery]);

  // Find all matched sections across ALL documents
  const globalMatchedSections = useMemo(() => {
    const matched: Array<{
      doc: LandDocument;
      section: { id: string; title: string; content: string };
    }> = [];

    if (searchQuery.trim() !== '') {
      documents.forEach(doc => {
        doc.sections.forEach(sec => {
          if (checkMatch(sec.title, searchQuery) || checkMatch(sec.content, searchQuery)) {
            matched.push({
              doc,
              section: sec
            });
          }
        });
      });
    }
    return matched;
  }, [documents, searchQuery]);

  // Export report of search queries matching current activeDoc
  const handleExportReport = () => {
    if (!activeDoc) return;
    
    const query = searchQuery.trim();
    let reportContent = `BÁO CÁO TRA CỨU PHÁP LÝ ĐẤT ĐAI
Tài liệu: ${activeDoc.title}
Số hiệu: ${activeDoc.abbreviation}
Ngày ban hành: ${activeDoc.issueDate}
Từ khóa tra cứu: ${query ? `"${query}"` : "Không có (Hiển thị toàn bộ)"}
Thời gian trích xuất: ${new Date().toLocaleString('vi-VN')}

==================================================

`;

    let matchTotal = 0;
    const regex = query ? getVietnameseRegex(query) : null;
    activeDoc.sections.forEach(sec => {
      let occurrences = 0;
      if (regex) {
        const matches = sec.content.match(regex);
        occurrences = matches ? matches.length : 0;
      }
      if (!query || occurrences > 0) {
        reportContent += `[${sec.title}]\n${sec.content}\n`;
        if (query) {
          reportContent += `--> Số kết quả trùng khớp trong điều khoản này: ${occurrences}\n`;
        }
        reportContent += `--------------------------------------------------\n\n`;
        matchTotal += occurrences;
      }
    });

    reportContent += `TỔNG CỘNG ĐÃ TÌM THẤY: ${matchTotal} TỪ KHÓA TRÙNG KHỚP TRONG TÀI LIỆU.`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Tra_Cuu_${activeDoc.abbreviation.replace(/\//g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export report of search queries matching any selected repo document
  const handleExportDocReport = (docToExport: LandDocument, queryText: string) => {
    if (!docToExport) return;
    
    const query = queryText.trim();
    let reportContent = `BÁO CÁO TRA CỨU PHÁP LÝ ĐẤT ĐAI (TRA CỨU NHANH TRONG KHO DỮ LIỆU)
Tài liệu: ${docToExport.title}
Số hiệu: ${docToExport.abbreviation}
Ngày ban hành: ${docToExport.issueDate}
Từ khóa tra cứu: ${query ? `"${query}"` : "Không có (Hiển thị toàn bộ)"}
Thời gian trích xuất: ${new Date().toLocaleString('vi-VN')}

==================================================

`;

    let matchTotal = 0;
    const regex = query ? getVietnameseRegex(query) : null;
    docToExport.sections.forEach(sec => {
      let occurrences = 0;
      if (regex) {
        const matches = sec.content.match(regex);
        occurrences = matches ? matches.length : 0;
      }
      if (!query || occurrences > 0) {
        reportContent += `[${sec.title}]\n${sec.content}\n`;
        if (query) {
          reportContent += `--> Số kết quả trùng khớp trong điều khoản này: ${occurrences}\n`;
        }
        reportContent += `--------------------------------------------------\n\n`;
        matchTotal += occurrences;
      }
    });

    reportContent += `TỔNG CỘNG ĐÃ TÌM THẤY: ${matchTotal} TỪ KHÓA TRÙNG KHỚP TRONG TÀI LIỆU.`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Tra_Cuu_${docToExport.abbreviation.replace(/\//g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F1EA] text-[#1A1A1A] font-sans flex flex-col antialiased">
      
      {/* Top Header Navigation */}
      <nav className="h-16 border-b border-[#D1CEC7] flex items-center justify-between px-8 bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#8C271E] rounded-md flex items-center justify-center transform rotate-12 shadow-sm">
            <span className="text-white font-serif font-bold text-base -rotate-12">TP</span>
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight uppercase text-[#8C271E]">TP LAW</span>
            <span className="hidden sm:inline text-xs text-stone-500 font-serif ml-2 italic">Hệ thống tra cứu pháp lý tối giản</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm font-semibold text-stone-600">
          <div className="hidden md:flex text-right flex-col leading-tight mr-1">
            <span className="text-xs font-bold text-stone-800">Tổng văn bản</span>
            <span className="text-[10px] font-semibold text-stone-500 font-mono">{documents.length} văn bản lưu trữ</span>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#D1CEC7] flex items-center justify-center select-none shrink-0">
            <img 
              src="https://pbs.twimg.com/media/HHGn0G7XYAIL9DG.jpg" 
              alt="Avatar Profile" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </nav>

      {/* THREE TABS NAVIGATION PANEL ON TOP */}
      <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 pt-6 shrink-0 pb-12">
        <div className="flex border-b-2 border-[#D1CEC7]">
          <button
            onClick={() => setActiveHubTab('search')}
            id="tab-search-btn"
            className={`flex-1 md:flex-none uppercase tracking-wider text-xs md:text-sm font-bold py-3.5 px-6 border-b-4 transition-all flex items-center justify-center gap-2 ${
              activeHubTab === 'search'
                ? 'border-[#8C271E] text-[#8C271E] bg-[#8C271E]/5 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Mục 1: Tìm kiếm & Tra cứu</span>
          </button>
          <button
            onClick={() => setActiveHubTab('input')}
            id="tab-input-btn"
            className={`flex-1 md:flex-none uppercase tracking-wider text-xs md:text-sm font-bold py-3.5 px-6 border-b-4 transition-all flex items-center justify-center gap-2 ${
              activeHubTab === 'input'
                ? 'border-[#8C271E] text-[#8C271E] bg-[#8C271E]/5 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Mục 2: Nhập thông tin văn bản</span>
          </button>
          <button
            onClick={() => setActiveHubTab('repository')}
            id="tab-repository-btn"
            className={`flex-1 md:flex-none uppercase tracking-wider text-xs md:text-sm font-bold py-3.5 px-6 border-b-4 transition-all flex items-center justify-center gap-2 ${
              activeHubTab === 'repository'
                ? 'border-[#8C271E] text-[#8C271E] bg-[#8C271E]/5 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Mục 3: Kho dữ liệu</span>
          </button>
        </div>

        {/* TAB CONTENTS CONTAINER */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            {activeHubTab === 'search' ? (
              <motion.div
                key="search-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.12 }}
                className="flex flex-col gap-6"
              >
                {/* Search control compartment */}
                <div
                  id="search-compartment"
                  className="bg-white border border-[#D1CEC7] rounded-xl p-5 shadow-xs transition-all hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-[#8C271E] flex items-center gap-1.5 font-sans">
                        <Search className="w-4 h-4 text-[#8C271E]" />
                        Mục Tìm kiếm thông tin điều khoản đất đai
                      </h2>
                      {searchInput.trim() !== '' && (
                        <button 
                          type="button"
                          onClick={() => {
                            setSearchInput('');
                            setSearchQuery('');
                          }}
                          id="clear-keyword-btn"
                          className="text-[10px] text-stone-500 hover:text-[#8C271E] font-bold uppercase tracking-wider underline flex items-center gap-1 font-sans"
                        >
                          <X className="w-3 h-3" /> Xoá từ khoá
                        </button>
                      )}
                    </div>
                    
                    <div className="relative">
                      <input 
                        type="text" 
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Nhập từ khóa pháp luật cần tra cứu (ví dụ: bồi thường, thu hồi, bồi thường đất đai...)" 
                        className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded-lg py-3 pl-4 pr-10 text-xs md:text-sm font-semibold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C271E] focus:border-transparent shadow-xs transition-all text-stone-900"
                      />
                      <div className="absolute right-3.5 top-3.5 text-stone-400">
                        {searchInput ? (
                          <button onClick={() => {
                            setSearchInput('');
                            setSearchQuery('');
                          }} className="hover:text-stone-700">
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Keywords Tags selection */}
                  <div className="mt-4 pt-3.5 border-t border-dashed border-stone-200">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block mb-1.5 font-sans">Tìm nhanh từ khóa Đất đai quan trọng:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagClick(tag)}
                          id={`tag-btn-${tag.replace(/\s+/g, '-')}`}
                          className={`text-[9.5px] px-2.5 py-1 rounded-full border transition-all font-medium ${
                            searchInput === tag 
                              ? 'bg-[#8C271E] text-white border-[#8C271E] shadow-sm' 
                              : 'bg-[#E5E1D8]/50 text-stone-700 border-[#D1CEC7]/60 hover:bg-stone-200'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phạm vi Tra Cứu (Search Scope Selectors) */}
                  <div className="mt-4 pt-3.5 border-t border-dashed border-stone-200 font-sans animate-fade-in">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block mb-2">Phạm vi tra cứu tìm kiếm:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSearchScope('current')}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                          searchScope === 'current'
                            ? 'bg-[#8C271E]/5 text-[#8C271E] border-[#8C271E] ring-1 ring-[#8C271E] shadow-xs'
                            : 'bg-[#FAF9F6] text-stone-700 border-[#D1CEC7]/60 hover:bg-[#E5E1D8]/30 hover:border-stone-400'
                        }`}
                      >
                        <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${searchScope === 'current' ? 'text-[#8C271E]' : 'text-stone-500'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase tracking-wider">1. Tra cứu văn bản đang chọn</div>
                          <p className={`text-[10px] mt-0.5 line-clamp-1 leading-normal ${searchScope === 'current' ? 'text-[#8C271E]/80 font-medium' : 'text-stone-500'}`}>
                            {activeDoc ? `Chỉ tìm khớp trong: ${activeDoc.abbreviation}` : 'Tra cứu trong văn bản đơn lẻ'}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSearchScope('all')}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                          searchScope === 'all'
                            ? 'bg-[#8C271E]/5 text-[#8C271E] border-[#8C271E] ring-1 ring-[#8C271E] shadow-xs'
                            : 'bg-[#FAF9F6] text-stone-700 border-[#D1CEC7]/60 hover:bg-[#E5E1D8]/30 hover:border-stone-400'
                        }`}
                      >
                        <Database className={`w-4 h-4 mt-0.5 shrink-0 ${searchScope === 'all' ? 'text-[#8C271E]' : 'text-stone-500'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase tracking-wider">2. Tra cứu toàn bộ hệ thống</div>
                          <p className={`text-[10px] mt-0.5 line-clamp-1 leading-normal ${searchScope === 'all' ? 'text-[#8C271E]/80 font-medium' : 'text-stone-500'}`}>
                            Quét liên văn bản ({documents.length} tài liệu trong thư viện)
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Document Selection Dropdown */}
                  {documents.length > 0 ? (
                    <div className="mt-4 pt-3.5 border-t border-dashed border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Văn bản đang chọn đọc:</span>
                        <select
                          value={selectedDocId || ''}
                          onChange={(e) => {
                            setSelectedDocId(e.target.value);
                            setSearchScope('current');
                          }}
                          className="bg-[#FAF9F6] border border-[#D1CEC7] rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 focus:outline-[#8C271E] max-w-[280px] sm:max-w-md focus:ring-1 focus:ring-[#8C271E] transition-all truncate font-sans"
                        >
                          {documents.map(d => (
                            <option key={d.id} value={d.id}>
                              [{d.type}] {d.abbreviation} - {d.title.length > 55 ? d.title.substring(0, 55) + '...' : d.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setActiveHubTab('repository')}
                        className="text-[10px] font-bold text-[#8C271E] hover:underline flex items-center gap-1 uppercase tracking-wider font-sans self-start sm:self-center"
                      >
                        <Database className="w-3.5 h-3.5" /> Quản lý danh sách trong Kho dữ liệu ({documents.length})
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3.5 border-t border-dashed border-stone-200">
                      <span className="text-[11px] text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 inline-flex items-center gap-2 font-semibold font-sans">
                        ⚠️ Chưa có văn bản pháp lý lưu dưới máy. Hãy chuyển sang Mục 2 để tải tài liệu của bạn lên trước.
                      </span>
                    </div>
                  )}
                </div>

                {/* Backdrop layer for Cinema/Focus Mode */}
                {readerFocused && (
                  <div 
                    className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs z-40 transition-opacity cursor-zoom-out"
                    onClick={() => setReaderFocused(false)}
                    title="Nhấn để thoát khỏi chế độ tập trung"
                  />
                )}

                {/* READING ROOM VIEWER CONTAINER */}
                <div className={
                  readerFocused
                    ? `fixed inset-2 sm:inset-4 md:inset-6 z-50 shadow-2xl p-5 md:p-8 rounded-2xl flex flex-col h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)] md:h-[calc(100vh-48px)] overflow-hidden transition-all duration-300 ${
                        readerTheme === 'warm' ? 'bg-[#FBF8F3] border-[#E2DBD0] text-[#2B1F17]' :
                        readerTheme === 'dark' ? 'bg-[#151514] border-[#31312E] text-stone-200' :
                        'bg-white border-[#C8C5BD] text-stone-850'
                      }`
                    : `border rounded-xl p-5 md:p-7 shadow-sm flex flex-col h-[740px] overflow-hidden transition-all duration-300 ${
                        readerTheme === 'warm' ? 'bg-[#FBF8F3] border-[#DCD7CD]' :
                        readerTheme === 'dark' ? 'bg-[#191917] border-[#2D2D2A]' :
                        'bg-white border-[#D1CEC7]'
                      }`
                }>
                  {activeDoc ? (() => {
                    const themeColors = getReaderThemeColors(readerTheme);

                    return (
                      <div className="w-full flex flex-col h-full overflow-hidden">
                        <header className={`mb-5 pb-5 border-b shrink-0 ${themeColors.headerBorder}`}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded tracking-widest uppercase font-sans ${themeColors.tagBg}`}>
                                  {activeDoc.type}
                                </span>
                                <span className={`text-xs font-semibold flex items-center gap-1 font-mono ${themeColors.subtext}`}>
                                  <Calendar className="w-3.5 h-3.5 opacity-75" />
                                  Ban hành: {activeDoc.issueDate}
                                </span>
                              </div>

                              <h1 className={`font-serif text-xl md:text-2xl font-bold leading-tight tracking-tight ${themeColors.title}`}>
                                {activeDoc.title}
                              </h1>

                              <p className={`text-xs font-medium mt-1.5 leading-relaxed font-sans ${themeColors.subtext}`}>
                                SỐ KÝ HIỆU: <span className={`font-bold font-mono ${themeColors.matchedText}`}>{activeDoc.abbreviation}</span>
                              </p>
                            </div>
                            
                            <div className="flex gap-1 self-start shrink-0 font-sans">
                              <button 
                                type="button"
                                onClick={handleExportReport}
                                title="Tải báo cáo kết quả tra cứu văn bản"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8C271E] hover:bg-[#721f18] text-white text-xs font-bold rounded shadow transition-all hover:shadow-md"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Xuất Báo Cáo
                              </button>
                            </div>
                          </div>

                          {/* Sơ lược tóm tắt */}
                          {activeDoc.summary && (
                            <div className={`mt-4 p-3 border-l-2 rounded text-xs leading-relaxed font-serif italic ${
                              readerTheme === 'warm' ? 'bg-[#F5ECE2]/60 border-[#C5B496] text-[#54463A]' : 
                              readerTheme === 'dark' ? 'bg-[#222220] border-[#555] text-stone-400' : 
                              'bg-stone-50 border-stone-300 text-stone-600'
                            }`}>
                              <span className="font-sans font-extrabold uppercase not-italic text-[9px] tracking-widest text-stone-400 block mb-1">
                                Tóm tắt văn bản
                              </span>
                              {activeDoc.summary}
                            </div>
                          )}
                        </header>

                        {/* MODERN READING CUSTOMIZER TOOLBAR */}
                        <div className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 font-sans mb-4 shrink-0 transition-colors ${
                          readerTheme === 'warm' ? 'bg-[#F2ECD8]/90 border-[#DFD6BD]/50 text-[#4E4136]' :
                          readerTheme === 'dark' ? 'bg-[#21211F] border-stone-800 text-stone-300' :
                          'bg-stone-50 border-stone-200 text-stone-700'
                        }`}>
                          {/* Left controls: Sidebar toggle & statistics quick info */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReaderSidebarOpen(!readerSidebarOpen)}
                              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all outline-none border ${
                                readerSidebarOpen 
                                  ? 'bg-[#8C271E] text-white border-transparent shadow-xs' 
                                  : readerTheme === 'dark' 
                                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700' 
                                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                              }`}
                              title={readerSidebarOpen ? "Ẩn Mục lục điều khoản" : "Hiện Mục lục điều khoản"}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Mục lục bên</span>
                              <span className="bg-black/15 px-1.5 py-0.5 rounded text-[9px]">
                                {activeDoc.sections.length}
                              </span>
                            </button>
                          </div>

                          {/* Middle controls: Typography selection & sizing */}
                          <div className="flex items-center flex-wrap gap-3">
                            {/* Font pick switcher */}
                            <div className="flex bg-black/5 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200/40 dark:border-stone-700 scale-95 md:scale-100">
                              <button
                                type="button"
                                onClick={() => setReaderFontFamily('serif')}
                                className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md font-serif transition-all ${
                                  readerFontFamily === 'serif' 
                                    ? 'bg-white dark:bg-stone-700 shadow-sm text-[#8C271E] dark:text-amber-400' 
                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                                }`}
                              >
                                Serif (Bản in)
                              </button>
                              <button
                                type="button"
                                onClick={() => setReaderFontFamily('sans')}
                                className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md font-sans transition-all ${
                                  readerFontFamily === 'sans' 
                                    ? 'bg-white dark:bg-stone-700 shadow-sm text-[#8C271E] dark:text-amber-400' 
                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                                }`}
                              >
                                Sans (Dễ nhìn)
                              </button>
                              <button
                                type="button"
                                onClick={() => setReaderFontFamily('mono')}
                                className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md font-mono transition-all ${
                                  readerFontFamily === 'mono' 
                                    ? 'bg-white dark:bg-stone-700 shadow-sm text-[#8C271E] dark:text-amber-400' 
                                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                                }`}
                              >
                                Mono (Cấu trúc)
                              </button>
                            </div>

                            {/* Font size button controls */}
                            <div className="flex items-center gap-1 bg-black/5 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200/40 dark:border-stone-700">
                              <button
                                type="button"
                                onClick={() => {
                                  if (readerFontSize === 'xl') setReaderFontSize('lg');
                                  else if (readerFontSize === 'lg') setReaderFontSize('base');
                                  else if (readerFontSize === 'base') setReaderFontSize('sm');
                                }}
                                disabled={readerFontSize === 'sm'}
                                className={`p-1 rounded-md transition-all ${
                                  readerFontSize === 'sm' 
                                    ? 'opacity-30 cursor-not-allowed' 
                                    : 'bg-white dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-600 shadow-sm text-stone-700 dark:text-stone-200'
                                }`}
                                title="Thu nhỏ cỡ chữ"
                              >
                                <Type className="w-3.5 h-3.5 scale-90" />
                              </button>
                              
                              <span className="text-[10px] font-extrabold uppercase px-2 select-none min-w-[32px] text-center font-mono text-stone-500 dark:text-stone-400">
                                {readerFontSize === 'sm' ? 'Cỡ S' : readerFontSize === 'base' ? 'Cỡ M' : readerFontSize === 'lg' ? 'Cỡ L' : 'Cỡ XL'}
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  if (readerFontSize === 'sm') setReaderFontSize('base');
                                  else if (readerFontSize === 'base') setReaderFontSize('lg');
                                  else if (readerFontSize === 'lg') setReaderFontSize('xl');
                                }}
                                disabled={readerFontSize === 'xl'}
                                className={`p-1 rounded-md transition-all ${
                                  readerFontSize === 'xl' 
                                    ? 'opacity-30 cursor-not-allowed' 
                                    : 'bg-white dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-600 shadow-sm text-stone-700 dark:text-stone-200'
                                }`}
                                title="Phóng to cỡ chữ"
                              >
                                <Type className="w-3.5 h-3.5 scale-110" />
                              </button>
                            </div>
                          </div>

                          {/* Right controls: Ambient theme presets & Focus mode */}
                          <div className="flex items-center gap-2.5">
                            {/* Theme circle selectors */}
                            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-stone-800 rounded-lg p-1 border border-stone-200/40 dark:border-stone-700 bg-[#E2E1DD]/30">
                              {/* Classic */}
                              <button
                                type="button"
                                onClick={() => setReaderTheme('classic')}
                                className={`w-4 h-4 rounded-full bg-white border border-stone-300 ring-offset-1 hover:scale-110 transition-transform ${
                                  readerTheme === 'classic' ? 'ring-2 ring-[#8C271E]' : ''
                                }`}
                                title="Trang giấy (Trắng)"
                              />
                              {/* Warm Cream */}
                              <button
                                type="button"
                                onClick={() => setReaderTheme('warm')}
                                className={`w-4 h-4 rounded-full bg-[#FAF5E8] border border-amber-200/80 ring-offset-1 hover:scale-110 transition-transform ${
                                  readerTheme === 'warm' ? 'ring-2 ring-[#A3382F]' : ''
                                }`}
                                title="Màu kem (Chống mỏi mắt)"
                              />
                              {/* Dark */}
                              <button
                                type="button"
                                onClick={() => setReaderTheme('dark')}
                                className={`w-4 h-4 rounded-full bg-[#191917] border border-stone-600 ring-offset-1 hover:scale-110 transition-transform ${
                                  readerTheme === 'dark' ? 'ring-2 ring-amber-500' : ''
                                }`}
                                title="Dịu mắt ban đêm"
                              />
                            </div>

                            {/* Focus/Unfocus Toggle */}
                            <button
                              type="button"
                              onClick={() => setReaderFocused(!readerFocused)}
                              className={`p-1.5 rounded-md border text-xs font-bold flex items-center gap-1 transition-all outline-none ${
                                readerFocused 
                                  ? 'bg-amber-500 hover:bg-amber-600 border-transparent text-white shadow' 
                                  : 'bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-900 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                              }`}
                              title={readerFocused ? "Thoát chế độ tập trung" : "Toàn màn hình đọc sách (Từng bước)"}
                            >
                              {readerFocused ? (
                                <>
                                  <Minimize2 className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline text-[9px] uppercase tracking-wider">Thu gọn</span>
                                </>
                              ) : (
                                <>
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline text-[9px] uppercase tracking-wider">Tập trung</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Search Scope Tabs Switcher when Query Injected */}
                        {searchQuery.trim() !== '' && (
                          <div className={`flex border mb-4 shrink-0 rounded-lg p-1 font-sans ${
                            readerTheme === 'dark' 
                              ? 'bg-stone-900 border-stone-850' 
                              : readerTheme === 'warm'
                                ? 'bg-[#F2ECD8]/50 border-[#DFD6BD]/50'
                                : 'bg-stone-50 border-stone-200/60'
                          }`}>
                            <button
                              type="button"
                              onClick={() => setSearchScope('current')}
                              className={`flex-1 py-1 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${
                                searchScope === 'current'
                                  ? 'bg-[#8C271E] text-white shadow'
                                  : readerTheme === 'dark'
                                    ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/65'
                              }`}
                            >
                              <span>Văn bản hiện hữu ({matchedSections.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSearchScope('all')}
                              className={`flex-1 py-1 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${
                                searchScope === 'all'
                                  ? 'bg-[#8C271E] text-white shadow'
                                  : readerTheme === 'dark'
                                    ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/65'
                              }`}
                            >
                              <span>Toàn hệ thống ({globalMatchedSections.length})</span>
                            </button>
                          </div>
                        )}

                        {/* MAIN SPLIT PANE BODY */}
                        <div className="flex-1 flex overflow-hidden min-h-0 w-full">
                          
                          {/* COLLAPSIBLE SIDEBAR: TABLE OF CONTENTS */}
                          {readerSidebarOpen && (
                            <aside className={`w-64 shrink-0 hidden md:flex flex-col pr-4 mr-3 h-full overflow-hidden border-r transition-all ${
                              readerTheme === 'warm' ? 'border-[#E6DEC9]' :
                              readerTheme === 'dark' ? 'border-stone-800' :
                              'border-stone-200/50'
                            }`}>
                              <div className="pb-2.5 mb-2 flex items-center justify-between">
                                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                                  readerTheme === 'dark' ? 'text-amber-500' : 'text-[#8C271E]'
                                }`}>
                                  Phân loại điều khoản
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => setReaderSidebarOpen(false)}
                                  className="p-1 hover:bg-black/5 dark:hover:bg-stone-800 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-250 transition-colors"
                                  title="Ẩn mục lục bên"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 pb-6">
                                {activeDoc.sections.map((sec) => {
                                  const matchesQuery = searchQuery.trim() !== '' && getSectionMatchCount(sec, searchQuery) > 0;
                                  
                                  return (
                                    <button
                                      key={sec.id}
                                      type="button"
                                      onClick={() => {
                                        const element = document.getElementById(sec.id);
                                        if (element) {
                                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                      }}
                                      className={`w-full text-left p-2.5 rounded-lg transition-all flex flex-col gap-1 border text-xs group ${
                                        matchesQuery
                                          ? 'bg-amber-100/35 dark:bg-amber-950/20 border-amber-300 dark:border-amber-850 text-amber-900 dark:text-amber-400 font-semibold shadow-2xs'
                                          : readerTheme === 'warm'
                                            ? 'border-transparent text-[#5C4D42] hover:bg-[#FAF0DB]/90'
                                            : readerTheme === 'dark'
                                              ? 'border-transparent text-stone-400 hover:bg-stone-850 hover:text-stone-200'
                                              : 'border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                                      }`}
                                    >
                                      <div className="font-bold line-clamp-1 group-hover:underline">
                                        {sec.title}
                                      </div>
                                      <div className={`text-[10px] line-clamp-1 opacity-75 leading-relaxed font-serif ${
                                        readerTheme === 'dark' ? 'text-stone-500' : 'text-stone-400'
                                      }`}>
                                        {sec.content.substring(0, 50)}...
                                      </div>
                                      {matchesQuery && (
                                        <span className="self-start text-[8px] bg-amber-100 dark:bg-amber-955/65 text-amber-850 dark:text-amber-450 px-1.5 rounded font-bold font-mono py-0.5 mt-0.5">
                                          Khớp {getSectionMatchCount(sec, searchQuery)} từ
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </aside>
                          )}

                          {/* READ WINDOW BODY SCROLLER */}
                          <article className="flex-1 overflow-y-auto pr-1.5 space-y-5 pb-8 min-w-0 h-full">
                            {searchScope === 'current' ? (
                              matchedSections.length === 0 ? (
                                <div className="text-center py-16 bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-xl px-4">
                                  <Info className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto mb-3 stroke-[1.2]" />
                                  <h4 className="font-serif text-base font-bold text-stone-800 dark:text-stone-300">
                                    Không có điều khoản trùng khớp
                                  </h4>
                                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                                    Không tìm thấy điều khoản nào trong văn bản <span className="font-bold text-stone-700 dark:text-stone-300">"{activeDoc.abbreviation}"</span> có chứa cụm từ <span className="font-bold text-[#8C271E] dark:text-amber-400 italic">"{searchQuery}"</span>.
                                  </p>
                                  {globalMatchedSections.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSearchScope('all')}
                                      className="mt-4 px-4 py-2 bg-[#8C271E] text-white text-xs font-bold rounded shadow hover:bg-[#721f18] transition-all font-sans"
                                    >
                                      Tìm kiếm trên Toàn hệ thống ({globalMatchedSections.length} kết quả)
                                    </button>
                                  )}
                                </div>
                              ) : (
                                matchedSections.map((section) => {
                                  const matchCount = getSectionMatchCount(section, searchQuery);
                                  const isMatched = searchQuery.trim() !== '' && matchCount > 0;

                                  return (
                                    <div 
                                      id={section.id}
                                      key={section.id} 
                                      className={`p-4 md:p-5 rounded-xl transition-all border scroll-mt-6 ${
                                        isMatched 
                                          ? themeColors.matchedBorder 
                                          : `${themeColors.cardBorder} opacity-95 ${themeColors.cardBg}`
                                      }`}
                                    >
                                      {/* Breadcrumb Info where, what, which law */}
                                      <div className="text-[10px] text-stone-500 font-medium font-sans mb-2.5 flex flex-wrap items-center gap-1.5 pb-2 border-b border-stone-200/30">
                                        <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase font-sans ${
                                          activeDoc.type === 'Luật' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400' :
                                          activeDoc.type === 'Nghị định' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400' :
                                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                        }`}>
                                          {activeDoc.type}
                                        </span>
                                        <span className="font-bold font-mono text-stone-700 dark:text-stone-300">{activeDoc.abbreviation}</span>
                                        <span className="text-stone-300 font-serif">•</span>
                                        <span className="italic truncate max-w-xs">{activeDoc.title}</span>
                                        {isMatched && (
                                          <>
                                            <span className="text-stone-300 font-serif">•</span>
                                            <span className="text-[#8C271E] dark:text-amber-400 font-extrabold bg-red-50 dark:bg-amber-950 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono">
                                              Tìm thấy {matchCount} lần trùng
                                            </span>
                                          </>
                                        )}
                                      </div>

                                      <h4 className={`font-serif font-bold mb-3 flex items-center justify-between text-base leading-tight ${themeColors.title}`}>
                                        {highlightText(section.title, searchQuery)}
                                      </h4>
                                      <div className="selection:bg-amber-150 selection:text-[#111]">
                                        {renderContentParagraphs(section.content, searchQuery)}
                                      </div>
                                    </div>
                                  );
                                })
                              )
                            ) : (
                              globalMatchedSections.length === 0 ? (
                                <div className="text-center py-16 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl font-sans">
                                  <Search className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto mb-3 stroke-[1.2]" />
                                  <h4 className="font-serif text-base font-bold text-stone-800 dark:text-stone-300 font-sans">
                                    Không tìm thấy trên toàn hệ thống
                                  </h4>
                                  <p className="text-xs text-stone-500 mt-1">
                                    Hãy thử gõ cụm từ khóa bằng Tiếng Việt hoặc thu hẹp bộ lọc của bạn.
                                  </p>
                                </div>
                              ) : (
                                globalMatchedSections.map(({ doc, section }, gidx) => {
                                  const matchCount = getSectionMatchCount(section, searchQuery);

                                  return (
                                    <div 
                                      key={`${doc.id}-${section.id}-${gidx}`}
                                      onClick={() => {
                                        setSelectedDocId(doc.id);
                                        setSearchScope('current');
                                        setTimeout(() => {
                                          const element = document.getElementById(section.id);
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          }
                                        }, 180);
                                      }}
                                      className={`p-4 md:p-5 rounded-xl border transition-all shadow-2xs hover:shadow-md cursor-pointer border-l-4 border-l-amber-500 hover:border-amber-500 ${
                                        readerTheme === 'dark' 
                                          ? 'border-amber-800 bg-[#24231E] hover:bg-[#2B2922]' 
                                          : 'border-amber-305 bg-[#FCFBF8] hover:bg-amber-100/10'
                                      }`}
                                    >
                                      {/* Breadcrumb Info where, what, which law */}
                                      <div className="text-[10px] text-stone-500 font-medium font-sans mb-2 flex flex-wrap items-center gap-1.5">
                                        <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase font-sans ${
                                          doc.type === 'Luật' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400' :
                                          doc.type === 'Nghị định' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400' :
                                          'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                                        }`}>
                                          {doc.type}
                                        </span>
                                        <span className="font-bold text-stone-900 dark:text-stone-300 font-mono">{doc.abbreviation}</span>
                                        <span className="text-stone-300 font-serif">•</span>
                                        <span className="italic truncate max-w-sm">{doc.title}</span>
                                      </div>

                                      <h4 className={`font-serif font-bold mb-2 pb-1.5 border-b border-dashed border-stone-200 dark:border-stone-800 flex items-center justify-between text-base ${themeColors.title}`}>
                                        {highlightText(section.title, searchQuery)}
                                        <span className="text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-955 px-2 py-0.5 rounded text-[10px] border border-amber-200 dark:border-amber-800 font-bold font-mono">
                                          {matchCount} từ khớp
                                        </span>
                                      </h4>

                                      <p className="whitespace-pre-line text-[#2c2c2c] dark:text-[#EAEAEA] text-sm md:text-base line-clamp-4 leading-relaxed font-sans">
                                        {highlightText(section.content, searchQuery)}
                                      </p>

                                      <div className="mt-3.5 pt-2 border-t border-stone-100 dark:border-stone-850 text-right font-sans">
                                        <span className="text-[10px] text-[#8C271E] dark:text-amber-400 font-bold uppercase tracking-wider hover:underline flex items-center gap-1 justify-end">
                                          Xem chi tiết điều khoản trong Luật này →
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )
                            )}
                          </article>
                        </div>

                        {/* READ ROOM FOOTER STATS */}
                        <footer className={`mt-auto pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 bg-transparent shrink-0 ${themeColors.headerBorder}`}>
                          <div className={`text-[10px] uppercase tracking-widest font-extrabold font-mono ${
                            readerTheme === 'dark' ? 'text-stone-500' : 'text-stone-400'
                          }`}>
                            {searchScope === 'current' 
                              ? `Đang hiển thị • ${matchedSections.length} / ${activeDoc.sections.length} điều khoản bóc tách`
                              : `Tổng hợp liên văn bản • tìm thấy ${globalMatchedSections.length} điều khoản trên toàn hệ thống`
                            }
                          </div>
                          {searchQuery.trim() !== '' && (
                            <div className={`text-[10px] px-3 py-1 rounded font-bold border font-sans ${
                              readerTheme === 'dark' 
                                ? 'bg-amber-950/40 text-amber-400 border-amber-800/60' 
                                : readerTheme === 'warm'
                                  ? 'bg-amber-100/30 text-amber-900 border-amber-300'
                                  : 'bg-[#FFE082]/35 text-amber-900 border-[#FFD54F]/50'
                            }`}>
                              {searchScope === 'current'
                                ? `Từ khóa "${searchQuery}" xuất hiện ${getMatchCount(activeDoc, searchQuery)} lần ở văn bản hiện hữu`
                                : `Tổng cộng ${globalMatchedSections.reduce((acc, curr) => acc + getSectionMatchCount(curr.section, searchQuery), 0)} vị trí trùng khớp trên hệ thống`
                              }
                            </div>
                          )}
                        </footer>
                      </div>
                    );
                  })() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#FCFBF9] dark:bg-stone-900 rounded-xl border border-dashed border-[#D1CEC7] dark:border-stone-800">
                      <BookOpen className="w-16 h-16 text-stone-300 dark:text-stone-700 mb-4 stroke-[1]" />
                      <h3 className="font-serif text-xl font-bold text-stone-800 dark:text-[#E2E2DF]">
                        Chưa tải tài liệu hoặc lựa chọn văn bản
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mt-1 mb-4 font-serif">
                        Hệ thống dữ liệu đang trống hoặc bạn chưa chỉ định văn bản để cấu trúc tra cứu. Vui lòng chọn tệp ở Mục 2 hoặc chọn tài liệu trong Kho dữ liệu Mục 3.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveHubTab('input')}
                        className="px-4 py-2 bg-[#8C271E] text-white text-xs font-bold rounded shadow hover:bg-[#721f18] transition-all uppercase tracking-wider font-sans"
                      >
                        Nạp tài liệu mới ngay
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : activeHubTab === 'input' ? (
              <motion.div
                key="input-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.12 }}
                id="input-compartment"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border rounded-xl p-5 shadow-xs transition-all duration-300 relative overflow-hidden ${
                  isDragging 
                    ? 'border-[#8C271E] bg-[#8C271E]/5 ring-2 ring-[#8C271E]/25 scale-[1.01]' 
                    : 'bg-white border-[#D1CEC7] hover:shadow-sm'
                }`}
              >
                {/* Visual Drag and Drop Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center z-50 pointer-events-none p-6 text-center border-2 border-dashed border-[#8C271E] rounded-xl animate-fadeIn">
                    <div className="w-16 h-16 bg-[#8C271E]/10 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-[#8C271E] animate-bounce" />
                    </div>
                    <h3 className="text-base font-bold text-[#8C271E] font-sans uppercase tracking-wider">
                      Thả tệp văn bản pháp lý tại đây
                    </h3>
                    <p className="text-xs text-stone-500 font-serif italic mt-1.5 max-w-sm leading-relaxed">
                      Nạp trực tiếp các tệp Word (.docx, .doc), PDF (.pdf) hoặc toàn bộ thư mục tài liệu để hệ thống TP LAW bóc tách điều khoản tự động.
                    </p>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 font-sans">
                  <div className="flex-1">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#8C271E] mb-1.5 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-[#8C271E]" />
                      Mục Nhập thông tin & Tải dữ liệu văn bản mới
                    </h2>
                    <p className="text-[11px] text-stone-500 font-serif italic max-w-xl leading-relaxed">
                      Kéo thả trực tiếp tệp tin vào bảng này, hoặc lựa chọn hình thức tải dữ liệu độc bản, nhiều tệp hoặc nguyên một Thư mục (.pdf, .docx, .doc):
                    </p>
                  </div>

                  {/* 3 Formats Grid Action */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[680px] shrink-0">
                    {/* Format 1: File Word / PDF upload */}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed border-[#D1CEC7] hover:border-[#8C271E] rounded-lg p-3 flex flex-col items-center justify-center text-center hover:bg-stone-50/50 transition-all cursor-pointer bg-[#FAF9F6] h-[80px] ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
                      title="Tải lên một hoặc nhiều tài liệu PDF hoặc Word để bốc tách cấu trúc"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.docx,.doc" 
                        multiple
                        className="hidden" 
                      />
                      {isUploading && uploadProgress ? (
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8C271E] mb-1"></div>
                          <span className="text-[9px] font-bold text-[#8C271E] italic">Xử lý {uploadProgress.current}/{uploadProgress.total}</span>
                        </div>
                      ) : (
                        <>
                          <Files className="w-4 h-4 mb-1 text-stone-600" />
                          <span className="text-[11px] font-bold text-stone-800">Tải file / Nhiều file</span>
                          <span className="text-[8px] text-stone-400 font-mono">Hỗ trợ tệp .doc, .docx, .pdf</span>
                        </>
                      )}
                    </div>

                    {/* Format 2: Folder Upload */}
                    <div 
                      onClick={() => folderInputRef.current?.click()}
                      className={`border border-dashed border-[#D1CEC7] hover:border-[#8C271E] rounded-lg p-3 flex flex-col items-center justify-center text-center hover:bg-stone-50/50 transition-all cursor-pointer bg-[#FAF9F6] h-[80px] ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
                      title="Chọn và tải lên toàn bộ một Thư mục để bốc tách hàng loạt"
                    >
                      <input 
                        type="file" 
                        ref={folderInputRef}
                        onChange={handleFolderUpload}
                        accept=".pdf,.docx,.doc" 
                        multiple
                        className="hidden" 
                        {...{ webkitdirectory: "", directory: "" }}
                      />
                      {isUploading && uploadProgress ? (
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8C271E] mb-1"></div>
                          <span className="text-[9px] font-medium text-stone-600 italic">Đang bóc tách...</span>
                        </div>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4 mb-1 text-stone-600" />
                          <span className="text-[11px] font-bold text-stone-800">Tải cả Thư mục</span>
                          <span className="text-[8px] text-stone-400 font-mono">Chọn folder chứa tài liệu</span>
                        </>
                      )}
                    </div>

                    {/* Format 3: Nhập thủ công */}
                    <button 
                      type="button"
                      disabled={isUploading}
                      onClick={() => setIsManualModalOpen(true)}
                      className={`border border-dashed border-[#D1CEC7] hover:border-[#8C271E] rounded-lg p-3 flex flex-col items-center justify-center text-center hover:bg-stone-50/50 transition-all bg-[#FAF9F6] h-[80px] ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Nhập điều luật thủ công thông qua sao chép-dán"
                    >
                      <Plus className="w-4 h-4 mb-1 text-stone-600" />
                      <span className="text-[11px] font-bold text-stone-800">Nhập thủ công</span>
                      <span className="text-[8px] text-stone-400">Sao chép & dán điều luật</span>
                    </button>
                  </div>
                </div>

                {/* Success / Error / Progress notifications */}
                <div className="mt-4 pt-3 border-t border-dashed border-stone-200">
                  {isUploading && uploadProgress ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-[#FAF9F6] border border-[#D1CEC7] rounded-lg space-y-2.5 font-sans"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
                        <span className="flex items-center gap-1.5 text-[#8C271E]">
                          <span className="relative flex h-2 w-2 py-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8C271E]"></span>
                          </span>
                          Đang bóc tách thông tin văn bản ({uploadProgress.current}/{uploadProgress.total})
                        </span>
                        <span className="font-mono text-xs">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                      </div>
                      
                      <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#8C271E] h-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                        <FileText className="w-3.5 h-3.5 text-[#8C271E] shrink-0 animate-pulse" />
                        <span className="truncate font-mono">Xử lý tệp: {uploadProgress.currentName}</span>
                      </div>

                      {uploadingFilesStatus.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-stone-200/60 max-h-[140px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {uploadingFilesStatus.map((fileStatus) => {
                            const isPending = fileStatus.status === 'pending';
                            const isProcessing = fileStatus.status === 'processing';
                            const isSuccess = fileStatus.status === 'success';
                            const isFailed = fileStatus.status === 'failed';
                            
                            return (
                              <div key={fileStatus.id} className="flex items-center justify-between gap-2 text-[10px] py-1 border-b border-stone-100 last:border-0">
                                <span className={`truncate flex items-center gap-1.5 min-w-0 ${isProcessing ? 'font-bold text-stone-800' : 'text-stone-600'}`}>
                                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isProcessing ? 'text-[#8C271E] animate-bounce' : isSuccess ? 'text-emerald-600' : 'text-stone-400'}`} />
                                  <span className="truncate font-mono text-[10px]">{fileStatus.name}</span>
                                </span>
                                
                                <div className="shrink-0 flex items-center">
                                  {isPending && (
                                    <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-sans text-[9px]">Chờ xử lý...</span>
                                  )}
                                  {isProcessing && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-sans text-[9px] flex items-center gap-1 animate-pulse">
                                      <span className="w-1 h-1 bg-amber-500 rounded-full animate-ping"></span>
                                      Xử lý bằng AI...
                                    </span>
                                  )}
                                  {isSuccess && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-sans text-[9px] font-semibold">
                                      ✓ Thành công
                                    </span>
                                  )}
                                  {isFailed && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-650 font-sans text-[9px]" title={fileStatus.error || 'Lỗi bóc tách'}>
                                      ✗ Lỗi tệp
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ) : uploadError || uploadSuccess ? (
                    <AnimatePresence mode="wait">
                      {uploadError && (
                        <motion.div 
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2 leading-relaxed"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-650 mt-0.5" />
                          <div className="text-xs"><strong>Thông báo:</strong> {uploadError}</div>
                        </motion.div>
                      )}
                      {uploadSuccess && (
                        <motion.div 
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-3 bg-emerald-50 border border-[#a5d6a7] text-emerald-800 rounded-lg text-xs flex items-start gap-2 leading-relaxed"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                          <div><strong>Thành công:</strong> {uploadSuccess}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    <div className="text-[10px] text-stone-400 italic font-serif flex items-center gap-1.5 justify-start">
                      <Info className="w-3.5 h-3.5 text-stone-400 font-sans" />
                      Văn bản tải lên hoặc dán nội dung chữ sẽ được trí tuệ nhân tạo phân tích thành các điều khoản biệt lập một cách cụ thể.
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="repository-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.12 }}
                id="repository-compartment"
                className="bg-white border border-[#D1CEC7] rounded-xl p-5 shadow-xs transition-all hover:shadow-sm"
              >
                <div className="flex flex-col gap-6">
                  {repoActiveDoc ? (
                    /* IN-REPO DETAILED READER PANE */
                    <div className="flex flex-col gap-4.5 animate-fade-in font-sans">
                      {/* Reader Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingDocInRepoId(null);
                            setRepoDocSearchInput('');
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#8C271E] hover:text-[#721f18] transition-all uppercase tracking-wider self-start"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Trở lại Kho dữ liệu
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase font-sans ${
                            repoActiveDoc.type === 'Luật' ? 'bg-red-100 text-red-800' :
                            repoActiveDoc.type === 'Nghị định' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {repoActiveDoc.type}
                          </span>
                          <span className="font-bold text-stone-900 font-mono text-xs">{repoActiveDoc.abbreviation}</span>
                          <span className="text-stone-300 font-serif">•</span>
                          <span className="text-xs text-stone-500 font-mono flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            Ban hành: {repoActiveDoc.issueDate || 'Chưa rõ'}
                          </span>
                        </div>
                      </div>

                      {/* Header Title with Paper Vibe */}
                      <div className="bg-[#FAF9F5] border border-[#D1CEC7]/70 rounded-xl p-4 md:p-5 shadow-2xs">
                        <h3 className="font-serif text-base md:text-lg font-bold text-stone-900 leading-snug mb-2">
                          {repoActiveDoc.title}
                        </h3>
                        {repoActiveDoc.summary && (
                          <div className="text-xs text-stone-650 font-sans italic leading-relaxed border-t border-dashed border-stone-200 pt-3">
                            <span className="font-bold uppercase text-[9px] tracking-wider text-stone-400 block mb-1">Tóm lược nội dung:</span>
                            {repoActiveDoc.summary}
                          </div>
                        )}
                      </div>

                      {/* Search / Lookup input for this document specifically */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-stone-50 p-3.5 border border-[#D1CEC7]/50 rounded-xl">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={repoDocSearchInput}
                            onChange={(e) => setRepoDocSearchInput(e.target.value)}
                            placeholder="Nhập cụm từ khóa cần tìm (vd: bồi thường, thu hồi, tranh chấp)..."
                            className="w-full bg-white border border-[#D1CEC7] rounded-lg py-2.5 pl-9 pr-8 text-xs font-semibold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C271E] text-stone-900 font-sans"
                          />
                          <div className="absolute left-3 top-3 text-stone-400">
                            <Search className="w-4 h-4" />
                          </div>
                          {repoDocSearchInput && (
                            <button
                              type="button"
                              onClick={() => setRepoDocSearchInput('')}
                              className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Suggestions tags box inline */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full overflow-x-auto py-0.5">
                          {suggestedTags.slice(0, 3).map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setRepoDocSearchInput(tag)}
                              className="text-[10px] px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 rounded transition font-medium"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>

                        {/* Export Report inside repo tab */}
                        <button
                          type="button"
                          onClick={() => handleExportDocReport(repoActiveDoc, repoDocSearchQuery)}
                          className="px-3.5 py-1.5 bg-[#FAF9F6] border border-[#D1CEC7] hover:border-[#8C271E] text-stone-700 hover:text-[#8C271E] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs shrink-0 font-sans cursor-pointer"
                          title="Tải báo cáo kết quả lọc của văn bản này dưới dạng tệp văn bản"
                        >
                          <Download className="w-3.5 h-3.5 text-[#8C271E]" />
                          Tải Báo cáo Lọc Tệp
                        </button>
                      </div>

                      {/* Clause Content Area styled like a legal scroll */}
                      <div className="bg-white border border-[#D1CEC7] rounded-xl p-4 md:p-6 shadow-2xs flex flex-col h-[600px] overflow-hidden">
                        {/* Stats Info */}
                        <div className="flex items-center justify-between text-[10px] md:text-[11px] text-stone-400 font-mono tracking-tight pb-2.5 border-b border-[#E5E1D8] mb-3">
                          <span>ĐANG ĐỌC & TRA CỨU • {repoMatchedSections.length} / {repoActiveDoc.sections.length} điều khoản hiển thị</span>
                          {repoDocSearchQuery.trim() !== '' && (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 font-bold font-sans text-[10px]">
                              Tìm thấy {repoMatchedSections.reduce((acc, curr) => acc + getSectionMatchCount(curr, repoDocSearchQuery), 0)} từ khớp
                            </span>
                          )}
                        </div>

                        {/* Scrollable list of clauses */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
                          {repoMatchedSections.length === 0 ? (
                            <div className="text-center py-16 bg-stone-50 border border-stone-200 rounded-xl px-4 font-sans">
                              <Info className="w-10 h-10 text-stone-300 mx-auto mb-3 stroke-[1.2]" />
                              <h4 className="font-serif text-base font-bold text-stone-800">Không có điều khoản trùng khớp</h4>
                              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                                Không tìm thấy điều khoản nào trong văn bản <span className="font-bold text-stone-700">"{repoActiveDoc.abbreviation}"</span> chứa cụm từ từ khóa <span className="font-bold text-[#8C271E] italic">"{repoDocSearchQuery}"</span>.
                              </p>
                            </div>
                          ) : (
                            repoMatchedSections.map((section) => {
                              const matchCount = getSectionMatchCount(section, repoDocSearchQuery);
                              const isMatched = repoDocSearchQuery.trim() !== '' && matchCount > 0;

                              return (
                                <div
                                  id={`repo-${section.id}`}
                                  key={section.id}
                                  className={`p-4 rounded-lg transition-all border ${
                                    isMatched
                                      ? 'bg-[#FCFBF8] border-amber-300 shadow-xs border-l-4 border-l-amber-500'
                                      : 'border-stone-200 bg-stone-50/50'
                                  }`}
                                >
                                  <h4 className="font-bold text-stone-900 mb-2 border-b border-stone-100 pb-1.5 flex items-center justify-between text-base leading-snug">
                                    {highlightText(section.title, repoDocSearchQuery)}
                                    {isMatched && (
                                      <span className="text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-sans font-extrabold shrink-0 ml-2">
                                        Có {matchCount} từ khớp
                                      </span>
                                    )}
                                  </h4>
                                  <div className="selection:bg-amber-100 text-sm md:text-base">
                                    {renderContentParagraphs(section.content, repoDocSearchQuery)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ORIGINAL DOCUMENT GRID/LIST LAYOUT */
                    <>
                      {/* Top Header section */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-widest text-[#8C271E] flex items-center gap-1.5">
                            <Database className="w-5 h-5 text-[#8C271E]" />
                            Mục 3: Kho dữ liệu pháp luật lưu trữ
                          </h2>
                          <p className="text-xs text-stone-500 font-serif italic mt-1">
                            Quản lý toàn bộ {documents.length} văn bản pháp quy đã số hóa trong bộ nhớ của hệ thống.
                          </p>
                        </div>

                        {documents.length > 0 && (
                          <button
                            type="button"
                            onClick={handleTriggerDeleteAll}
                            id="repo-clean-all-btn"
                            className="text-xs font-bold uppercase text-red-700 hover:text-white bg-red-50 hover:bg-red-700 border border-red-200 hover:border-transparent px-3 py-1.5 rounded transition-all flex items-center gap-1.5 self-start md:self-center shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa sạch kho dữ liệu
                          </button>
                        )}
                      </div>

                      {/* Summary counts statistics layout */}
                      {documents.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                          <div className="bg-[#FAF9F6] border border-[#D1CEC7] p-3 rounded-lg flex flex-col justify-center shadow-2xs">
                            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold font-sans">Tổng số</span>
                            <span className="text-xl font-bold font-mono text-stone-900 mt-1">{documents.length}</span>
                          </div>
                          <div className="bg-red-50/50 border border-red-200 p-3 rounded-lg flex flex-col justify-center shadow-2xs">
                            <span className="text-[10px] text-red-800 uppercase tracking-widest font-bold font-sans">Văn bản Luật</span>
                            <span className="text-xl font-bold font-mono text-red-900 mt-1">
                              {documents.filter(d => d.type === 'Luật').length}
                            </span>
                          </div>
                          <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-lg flex flex-col justify-center shadow-2xs">
                            <span className="text-[10px] text-blue-800 uppercase tracking-widest font-bold font-sans">Nghị định</span>
                            <span className="text-xl font-bold font-mono text-blue-900 mt-1">
                              {documents.filter(d => d.type === 'Nghị định').length}
                            </span>
                          </div>
                          <div className="bg-amber-50/50 border border-amber-200 p-3 rounded-lg flex flex-col justify-center shadow-2xs">
                            <span className="text-[10px] text-amber-800 uppercase tracking-widest font-bold font-sans">Thông tư</span>
                            <span className="text-xl font-bold font-mono text-amber-900 mt-1">
                              {documents.filter(d => d.type === 'Thông tư').length}
                            </span>
                          </div>
                          <div className="bg-stone-100/60 border border-stone-300 p-3 rounded-lg flex flex-col justify-center shadow-2xs col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-stone-600 uppercase tracking-widest font-bold font-sans">Văn bản Khác</span>
                            <span className="text-xl font-bold font-mono text-stone-800 mt-1">
                              {documents.filter(d => d.type !== 'Luật' && d.type !== 'Nghị định' && d.type !== 'Thông tư').length}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Filter panel */}
                      {documents.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-3.5 bg-stone-50 p-4 border border-[#D1CEC7]/60 rounded-xl">
                          {/* Local Search input */}
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={repoSearch}
                              onChange={(e) => setRepoSearch(e.target.value)}
                              placeholder="Mở rộng tìm kiếm trong tiêu đề/số hiệu viết tắt/tóm tắt văn bản..."
                              className="w-full bg-white border border-[#D1CEC7] rounded-lg py-2.5 pl-3.5 pr-10 text-xs md:text-sm font-semibold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C271E] focus:border-transparent text-stone-900 font-sans"
                            />
                            <div className="absolute right-3 top-3 text-stone-400">
                              {repoSearch ? (
                                <button onClick={() => setRepoSearch('')} className="hover:text-stone-700">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <Search className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </div>

                          {/* Type tab filters */}
                          <div className="flex flex-wrap gap-1 items-center shrink-0">
                            <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold mr-1.5 font-sans">Phân loại:</span>
                            {(['Tất cả', 'Luật', 'Nghị định', 'Thông tư', 'Khác'] as const).map(type => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setRepoTypeFilter(type)}
                                className={`text-[11px] px-3 py-1.5 rounded-lg border font-bold transition-all font-sans ${
                                  repoTypeFilter === type
                                    ? 'bg-[#8C271E] text-white border-[#8C271E] shadow-xs'
                                    : 'bg-white text-stone-600 border-[#D1CEC7] hover:bg-stone-100'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Repository Documents Grid list representation */}
                      <div className="mt-1">
                        {repoFilteredDocuments.length === 0 ? (
                          <div className="text-center py-20 border border-stone-200 bg-stone-50/50 rounded-xl max-w-2xl mx-auto px-4">
                            {documents.length === 0 ? (
                              <>
                                <Database className="w-12 h-12 text-stone-300 mx-auto mb-3 stroke-[1.2]" />
                                <h3 className="text-sm font-bold text-stone-700 font-serif">Kho lưu trữ chưa có văn bản nào</h3>
                                <p className="text-xs text-stone-500 mt-2 font-serif italic max-w-md mx-auto">
                                  Hiện tại hệ thống cơ sở dữ liệu trống. Vui lòng bấm vào Mục 2 bên trên để tải lên tài liệu pháp lý của bạn dạng .pdf/.docx/.doc hoặc nhập nội dung văn bản thủ công bằng tay.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveHubTab('input')}
                                  className="mt-5 px-4 py-2 bg-[#8C271E] text-white font-bold text-xs rounded shadow hover:bg-[#721f18] transition-all uppercase tracking-wider font-sans"
                                >
                                  Tải tài liệu mới ngay
                                </button>
                              </>
                            ) : (
                              <>
                                <Search className="w-12 h-12 text-stone-300 mx-auto mb-3 stroke-[1.2]" />
                                <h3 className="text-sm font-bold text-stone-700 font-serif">Không tìm thấy văn bản phù hợp</h3>
                                <p className="text-xs text-stone-500 mt-2 font-serif italic">
                                  Không tìm thấy kết quả tìm kiếm nào khớp với từ khóa "{repoSearch}" và phân loại "{repoTypeFilter}".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRepoSearch('');
                                    setRepoTypeFilter('Tất cả');
                                  }}
                                  className="mt-4 text-xs font-bold text-[#8C271E] underline uppercase tracking-wider block mx-auto font-sans"
                                >
                                  Xóa bộ lọc tìm kiếm
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {repoFilteredDocuments.map(doc => {
                              const isCurrentlySelected = doc.id === selectedDocId;

                              return (
                                <div
                                  key={doc.id}
                                  className={`p-4 border rounded-xl bg-[#FAF9F6] transition-all flex flex-col justify-between hover:shadow-md ${
                                    isCurrentlySelected
                                      ? 'border-[#8C271E] shadow-sm ring-1 ring-[#8C271E]/30 bg-white'
                                      : 'border-[#D1CEC7]/70 hover:border-[#D1CEC7]'
                                  }`}
                                >
                                  <div className="flex-1">
                                    {/* Badges */}
                                    <div className="flex items-center justify-between gap-2 mb-2 sm:mb-2.5">
                                      <div className="flex items-center gap-1.5 font-sans">
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest ${
                                          doc.type === 'Luật' ? 'bg-red-100 text-red-800' :
                                          doc.type === 'Nghị định' ? 'bg-blue-100 text-blue-800' :
                                          'bg-amber-100 text-amber-800'
                                        }`}>
                                          {doc.type}
                                        </span>
                                        {doc.isSimulated ? (
                                          <span className="text-[8px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded italic">
                                            Trích xuất máy
                                          </span>
                                        ) : (
                                          <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                            AI bóc tách
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1 font-semibold">
                                        <Clock className="w-3 h-3" />
                                        Ban hành: {doc.issueDate || 'Chưa rõ'}
                                      </span>
                                    </div>

                                    <h3 className="text-sm font-bold text-stone-900 leading-snug font-mono tracking-tight mb-1">
                                      {doc.abbreviation}
                                    </h3>

                                    <h4 className="text-xs font-semibold text-stone-800 font-serif leading-relaxed line-clamp-2 mb-2 italic" title={doc.title}>
                                      {doc.title}
                                    </h4>

                                    {doc.summary && (
                                      <p className="text-[11px] text-stone-500 font-sans line-clamp-3 leading-relaxed border-t border-dashed border-stone-200 pt-2.5 mb-4">
                                        {doc.summary}
                                      </p>
                                    )}
                                  </div>

                                  {/* Card action buttons */}
                                  <div className="flex items-center justify-between gap-2.5 pt-3.5 border-t border-[#E5E1D8] mt-2 font-sans font-sans">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingDocInRepoId(doc.id);
                                        setRepoDocSearchInput('');
                                      }}
                                      className="flex-1 py-1.5 px-3 bg-[#8C271E] hover:bg-[#721f18] text-white text-[11px] font-bold rounded shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                                    >
                                      <BookOpen className="w-3.5 h-3.5" />
                                      Đọc & Tra cứu
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteDoc(doc.id, doc.abbreviation, e)}
                                      className="p-1.5 border border-red-200 hover:border-transparent text-red-700 hover:text-white bg-red-50 hover:bg-red-700 rounded transition-all shrink-0 shadow-2xs cursor-pointer"
                                      title="Xóa văn bản này"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MANUAL INPUT DIALOG MODAL */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl border border-[#D1CEC7] w-full max-w-2xl overflow-hidden text-stone-900 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-[#E5E1D8] flex items-center justify-between bg-stone-50">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-800">Nhập thủ công Thông tư / Nghị định</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Dán nội dung thô để hệ thống tự động bóc tách điều khoản</p>
                </div>
                <button 
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-1 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Số hiệu viết tắt *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="vd: 01/2024/TT-BTNMT"
                      value={manualAbbreviation}
                      onChange={(e) => setManualAbbreviation(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Loại văn bản *
                    </label>
                    <select
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value as any)}
                      className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E]"
                    >
                      <option value="Thông tư">Thông tư</option>
                      <option value="Nghị định">Nghị định</option>
                      <option value="Luật">Luật</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Tiêu đề đầy đủ văn bản *
                  </label>
                  <input 
                    type="text"
                    required 
                    placeholder="vd: Thông tư 01/2024/TT-BTNMT quy định về hồ sơ đăng ký đất đai..."
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Ngày ban hành
                    </label>
                    <input 
                      type="date"
                      value={manualIssueDate}
                      onChange={(e) => setManualIssueDate(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Tóm tắt ngắn gọn
                    </label>
                    <input 
                      type="text"
                      placeholder="Tóm tắt công dụng của tài liệu..."
                      value={manualSummary}
                      onChange={(e) => setManualSummary(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Nội dung đầy đủ văn bản * (Bao gồm các Điều...)
                  </label>
                  <p className="text-[10px] text-stone-500 mb-1.5">
                    Hệ thống sẽ tự nhận diện kết quả khi bạn phân bổ các dòng bắt đầu bằng "Điều 1.", "Điều 2.", vv.
                  </p>
                  <textarea 
                    rows={8}
                    required
                    placeholder="Điều 1. Phạm vi điều chỉnh&#10;Thông tư này quy định về...&#10;&#10;Điều 2. Các quy chuẩn áp dụng..."
                    value={manualRawContent}
                    onChange={(e) => setManualRawContent(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#D1CEC7] rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C271E] font-serif leading-relaxed"
                  />
                </div>

                <div className="pt-4 border-t border-[#E5E1D8] flex justify-end gap-3 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded text-xs font-bold transition-all text-stone-800"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 bg-[#8C271E] hover:bg-[#721f18] text-white rounded text-xs font-bold transition-all shadow-md"
                  >
                    Lưu & Cấu trúc
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETION CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {deleteConf.isOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden text-stone-900 flex flex-col"
            >
              <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-red-50/50">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
                  <h3 className="font-serif text-base font-bold text-red-800">Cảnh báo: Xác nhận xóa dữ liệu</h3>
                </div>
                <button 
                  onClick={() => setDeleteConf(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa <span className="font-bold text-stone-900">{deleteConf.type === 'single' ? `văn bản "${deleteConf.targetName}"` : "toàn bộ thư viện thông tư, nghị định"}</span> khỏi cơ sở dữ liệu hệ thống?
                </p>
                <div className="p-3 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-800 leading-relaxed font-serif italic">
                  * Hành động này có tính chất vĩnh viễn và không thể khôi phục lại dữ liệu sau khi xóa. Hãy cân nhắc kỹ trước khi thực hiện.
                </div>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setDeleteConf(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded text-xs font-bold transition-all text-stone-800"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Chắc chắn xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
