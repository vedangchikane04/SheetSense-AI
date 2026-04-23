import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { MessageSquare, Upload, Server, FileSpreadsheet, Paperclip, Send, PlusCircle, Trash2, X, Eye } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [sessionId, setSessionId] = useState('');
  const [history, setHistory] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [globalFiles, setGlobalFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewType, setPreviewType] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 100;
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    let currentSession = localStorage.getItem('excel_chat_session');
    if (!currentSession) {
      currentSession = uuidv4();
      localStorage.setItem('excel_chat_session', currentSession);
    }
    setSessionId(currentSession);
    fetchHistory(currentSession);
    fetchDatasets(currentSession);
    fetchSessions();
    fetchGlobalFiles();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const fetchHistory = async (session) => {
    try {
      const res = await axios.get(`${API_BASE}/history?session_id=${session}`);
      setHistory(res.data);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const fetchDatasets = async (session) => {
    try {
      const res = await axios.get(`${API_BASE}/files?session_id=${session}`);
      setDatasets(res.data.datasets);
    } catch (e) {
      console.error('Failed to fetch datasets', e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/sessions`);
      setPastSessions(res.data);
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  };

  const fetchGlobalFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/global-files`);
      setGlobalFiles(res.data.files);
    } catch (e) {
      console.error('Failed to fetch global files', e);
    }
  };

  const switchSession = (newSession) => {
    localStorage.setItem('excel_chat_session', newSession);
    setSessionId(newSession);
    fetchHistory(newSession);
    fetchDatasets(newSession);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    formData.append('session_id', sessionId);

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDatasets((prev) => [...new Set([...prev, ...res.data.datasets])]);
      
      const newSystemMessage = { 
        role: 'assistant', 
        content: `Successfully parsed and loaded data: **${res.data.datasets.join(', ')}**.\n\nYou can now ask me questions about this data!` 
      };
      setHistory((prev) => [...prev, newSystemMessage]);
      fetchGlobalFiles(); // Refresh global library in case it's a new upload
      
    } catch (error) {
      alert('File upload failed!');
      console.error(error);
    } finally {
      setLoading(false);
      // Reset input value to allow uploading same file continuously if needed
      if(fileInputRef.current) fileInputRef.current.value = ""; 
    }
  };

  const handleUseGlobalFile = async (filename) => {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('session_id', sessionId);
    
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/use-global-file`, formData);
      setDatasets((prev) => [...new Set([...prev, ...res.data.datasets])]);
      
      const newSystemMessage = { 
        role: 'assistant', 
        content: `Successfully loaded existing file: **${res.data.datasets.join(', ')}** into the current session.` 
      };
      setHistory((prev) => [...prev, newSystemMessage]);
    } catch (error) {
      alert('Failed to load global file!');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewDataset = async (datasetName, sheetName = null) => {
    try {
      let url = `${API_BASE}/dataset-preview?session_id=${sessionId}&dataset_name=${datasetName}`;
      if (sheetName) url += `&sheet_name=${encodeURIComponent(sheetName)}`;
      const res = await axios.get(url);
      setPreviewData(res.data);
      setPreviewTitle(datasetName);
      setPreviewType('active');
      setPreviewPage(0);
    } catch (e) {
      alert("Could not load preview.");
    }
  };

  const handlePreviewGlobalFile = async (filename, sheetName = null) => {
    try {
      let url = `${API_BASE}/global-file-preview?filename=${filename}`;
      if (sheetName) url += `&sheet_name=${encodeURIComponent(sheetName)}`;
      const res = await axios.get(url);
      setPreviewData(res.data);
      setPreviewTitle(filename);
      setPreviewType('global');
      setPreviewPage(0);
    } catch (e) {
      alert("Could not load preview.");
    }
  };

  const handleDeleteGlobalFile = async (filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${filename}?`)) return;
    try {
      await axios.delete(`${API_BASE}/global-file/${filename}`);
      fetchGlobalFiles();
    } catch (e) {
      alert("Failed to delete file.");
    }
  };

  const handleAddRow = () => {
    if (!previewData) return;
    const newRow = {};
    previewData.columns.forEach(col => newRow[col] = "");
    const newData = [...previewData.data, newRow];
    setPreviewData({
      ...previewData,
      data: newData
    });
    setPreviewPage(Math.floor((newData.length - 1) / PREVIEW_PAGE_SIZE));
  };

  const handleAddColumn = () => {
    if (!previewData) return;
    
    let baseName = "New_Column";
    let colName = baseName;
    let counter = 1;
    while (previewData.columns.includes(colName)) {
      colName = `${baseName}_${counter}`;
      counter++;
    }
    
    const newData = previewData.data.map(row => ({
      ...row,
      [colName]: ""
    }));
    
    setPreviewData({
      columns: [...previewData.columns, colName],
      data: newData
    });
  };

  const handleColumnRename = (oldName, newName) => {
    if (!newName || newName === oldName || previewData.columns.includes(newName)) return;
    
    const newColumns = previewData.columns.map(c => c === oldName ? newName : c);
    const newData = previewData.data.map(row => {
      const newRow = { ...row };
      newRow[newName] = newRow[oldName];
      delete newRow[oldName];
      return newRow;
    });

    setPreviewData({
      columns: newColumns,
      data: newData
    });
  };

  const handleCellChange = (rowIndex, colName, value) => {
    const newData = [...previewData.data];
    newData[rowIndex] = { ...newData[rowIndex], [colName]: value };
    setPreviewData({
      ...previewData,
      data: newData
    });
  };

  const handleSavePreview = async () => {
    if (!previewData) return;
    try {
      const payload = { data: previewData.data };
      if (previewType === 'active') {
        payload.session_id = sessionId;
        payload.dataset_name = previewData.current_sheet;
      } else {
        payload.filename = previewTitle;
        payload.sheet_name = previewData.current_sheet;
      }
      
      await axios.post(`${API_BASE}/save-dataset`, payload);
      alert("Changes saved successfully!");
    } catch (e) {
      alert("Failed to save changes.");
    }
  };

  const handleSend = async () => {
    if (!query.trim()) return;

    const userQuery = query;
    setQuery('');
    setHistory((prev) => [...prev, { role: 'user', content: userQuery }]);
    setLoading(true);

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('query', userQuery);

    try {
      const res = await axios.post(`${API_BASE}/query`, formData);
      setHistory((prev) => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (error) {
      setHistory((prev) => [...prev, { role: 'assistant', content: 'Ops! An error occurred on the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    const newSession = uuidv4();
    localStorage.setItem('excel_chat_session', newSession);
    setSessionId(newSession);
    setHistory([]);
    setDatasets([]);
    fetchSessions(); // refreshing past sessions to include the one we just left
  };

  const handleDeleteSession = async (e, sessionToDelete) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat forever?")) return;
    try {
      await axios.delete(`${API_BASE}/session/${sessionToDelete}`);
      if (sessionToDelete === sessionId) {
        startNewChat();
      } else {
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Made wider to accommodate larger text */}
      <div className="w-[450px] bg-slate-900 flex flex-col transition-all shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-4 font-semibold text-2xl text-white tracking-wide">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Server size={26} className="text-white" />
          </div>
          SheetSense AI
        </div>
        
        <div className="p-5">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-gray-200 transition px-5 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 shadow-sm font-medium text-xl"
          >
            <PlusCircle size={22} /> New Analysis
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 no-scrollbar px-4 pb-4">
          <h3 className="text-slate-400 text-sm font-bold tracking-wider uppercase mb-4 mt-2">Recent Chats</h3>
          {pastSessions.length === 0 ? (
            <div className="text-slate-500 text-[24px] italic py-2 px-1">
              No recent chats.
            </div>
          ) : (
            <ul className="space-y-2 mb-8">
              {pastSessions.map((session, idx) => (
                <li 
                  key={idx} 
                  onClick={() => switchSession(session.session_id)}
                  className={`flex items-start justify-between gap-2 text-[24px] p-4 rounded-xl border shadow-sm transition cursor-pointer group 
                    ${session.session_id === sessionId 
                      ? 'bg-slate-700 border-slate-600 text-white' 
                      : 'bg-slate-800 border-transparent text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="truncate block font-medium w-full text-left" title={session.title}>
                      {session.title}
                    </span>
                    <span className="text-[14px] text-slate-400 font-normal">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteSession(e, session.session_id)}
                    className="p-2 -mr-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all focus:outline-none shrink-0"
                    title="Delete Chat"
                  >
                    <Trash2 size={24} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-slate-400 text-sm font-bold tracking-wider uppercase mb-4 mt-6 pt-6 border-t border-white/10">Active Datasets</h3>
          {datasets.length === 0 ? (
            <div className="text-slate-500 text-[18px] italic bg-slate-800/50 p-4 rounded-xl text-center border border-dashed border-slate-700">
              No spreadsheets uploaded for this session.
            </div>
          ) : (
            <ul className="space-y-3">
              {datasets.map((ds, idx) => (
                <li key={idx} onClick={() => handlePreviewDataset(ds)} className="flex items-center gap-3 text-[18px] bg-slate-800 text-slate-200 p-4 rounded-xl border border-slate-700 shadow-sm transition hover:bg-slate-700 cursor-pointer">
                  <FileSpreadsheet size={20} className="text-emerald-400 shrink-0" />
                  <span className="truncate" title={ds}>{ds}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-slate-400 text-sm font-bold tracking-wider uppercase mb-4 mt-6 pt-6 border-t border-white/10">Upload History</h3>
          {globalFiles.length === 0 ? (
            <div className="text-slate-500 text-sm italic py-2 px-1">
              No previously uploaded files.
            </div>
          ) : (
            <ul className="space-y-2 mb-8">
              {globalFiles.map((file, idx) => (
                <li 
                  key={idx} 
                  className="flex items-center justify-between gap-3 text-[16px] bg-slate-800/80 text-slate-300 p-3 rounded-xl border border-transparent hover:border-slate-600 shadow-sm transition group hover:bg-slate-700 hover:text-white"
                >
                  <div className="flex items-center gap-3 truncate">
                    <FileSpreadsheet size={18} className="text-blue-400 shrink-0" />
                    <span className="truncate" title={file}>{file}</span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handlePreviewGlobalFile(file); }} className="text-slate-400 hover:text-blue-400 p-1.5 bg-slate-800 rounded-md transition-colors" title="View">
                      <Eye size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleUseGlobalFile(file); }} className="text-slate-400 hover:text-emerald-400 p-1.5 bg-slate-800 rounded-md transition-colors" title="Upload to chat">
                      <Upload size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGlobalFile(file); }} className="text-slate-400 hover:text-red-400 p-1.5 bg-slate-800 rounded-md transition-colors" title="Delete file">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-slate-50">
        
        {/* Chat History View */}
        <div className="flex-1 overflow-y-auto w-full pb-32 pt-8 no-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 max-w-lg w-full mb-8 transform hover:scale-105 transition duration-500">
                 <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageSquare size={36} className="text-blue-600" />
                 </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">Ask anything about your data</h2>
                <p className="text-slate-500 text-base mb-6 leading-relaxed">
                  Drop your CSV or multi-layered Excel files and uncover insights using simple human questions.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">"Highest revenue generator?"</span>
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">"Compare sales between sheets."</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full mx-auto space-y-8 px-8">
              {history.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {msg.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0 mt-1">
                      <Server size={18} className="text-white" />
                    </div>
                  )}
                  
                  <div className={`
                    px-6 py-4 rounded-3xl max-w-[85%] text-[24px] leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-slate-800 text-white rounded-br-sm' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm prose prose-blue prose-p:text-[24px] prose-li:text-[24px]'
                    }
                  `}>
                    {/* Render newlines properly for code/markdown simulation */}
                    {msg.content.split('\n').map((line, i) => {
                      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                      let elements = [];
                      let lastIndex = 0;
                      let match;

                      while ((match = linkRegex.exec(line)) !== null) {
                          if (match.index > lastIndex) {
                              elements.push(<span key={`text-${lastIndex}`}>{line.substring(lastIndex, match.index)}</span>);
                          }
                          const url = match[2].startsWith('http') ? match[2] : `${API_BASE}${match[2]}`;
                          elements.push(
                              <a key={`link-${match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold px-2 py-1 bg-blue-50 rounded-md inline-block">
                                  {match[1]}
                              </a>
                          );
                          lastIndex = match.index + match[0].length;
                      }
                      if (lastIndex < line.length) {
                          elements.push(<span key={`text-${lastIndex}`}>{line.substring(lastIndex)}</span>);
                      }

                      return (
                          <React.Fragment key={i}>
                              {elements}
                              <br />
                          </React.Fragment>
                      );
                    })}
                  </div>

                  {msg.role === 'user' && (
                     <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 mt-1 overflow-hidden shadow-sm">
                       <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${sessionId}`} alt="user" className="w-full h-full p-1" />
                     </div>
                  )}

                </div>
              ))}
              
              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-4 items-start justify-start animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                    <Server size={18} className="text-white" />
                  </div>
                  <div className="px-6 py-4 rounded-3xl bg-white border border-slate-200 rounded-bl-sm shadow-sm flex items-center gap-2 h-[56px]">
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                  </div>
                </div>
              )}
              
              {/* Invisible anchor to scroll into view */}
              <div ref={chatEndRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Input Text Box fixed bottom container */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-slate-50 via-slate-50 md:via-slate-50/90 to-transparent pt-12 pb-8 px-8">
          <div className="w-full mx-auto relative flex flex-col bg-white border border-slate-300 shadow-xl shadow-slate-200/50 rounded-2xl focus-within:ring-2 ring-blue-500/50 transition-all duration-300">
            
            <div className="flex items-center p-2 gap-2">
              {/* Hidden File Input */}
              <input 
                type="file" 
                multiple 
                accept=".csv, .xlsx, .xls"
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              
              {/* Attachment Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer flex-shrink-0 relative group"
                title="Upload Excel or CSV"
              >
                <Paperclip size={22} className="group-hover:rotate-12 transition-transform" />
              </button>
              
              {/* Main Text Input */}
              <input 
                type="text" 
                className="flex-1 bg-transparent py-3 px-2 text-slate-800 placeholder-slate-400 outline-none text-[24px]" 
                placeholder="Message your data... (e.g. 'Show me the top 5 regions by sales')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={loading}
                autoFocus
              />
              
              {/* Send Button */}
              <button 
                onClick={handleSend}
                disabled={loading || !query.trim()}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex-shrink-0"
              >
                <Send size={20} className={loading && query.trim() ? "animate-ping" : ""} />
              </button>
            </div>
            
          </div>
          <div className="text-center text-xs font-medium text-slate-400 mt-4 tracking-wide">
            Powered by Mistral AI • Always verify results independently
          </div>
        </div>

      </div>

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[98vw] h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <FileSpreadsheet className="text-emerald-500" />
                {previewTitle} <span className="text-sm font-normal text-slate-500 bg-slate-200 px-3 py-1 rounded-full">All Data</span>
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={handleAddColumn} className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">Add Column</button>
                <button onClick={handleAddRow} className="px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">Add Row</button>
                <button onClick={handleSavePreview} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm">Save Changes</button>
                <button onClick={() => setPreviewData(null)} className="p-2 ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-0 bg-white">
              <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                  <tr>
                    {previewData.columns.map((col, i) => (
                      <th key={i} className="p-2 font-semibold text-slate-700 border-b border-slate-200">
                        <input 
                          key={`header-${col}`}
                          type="text" 
                          defaultValue={col}
                          onBlur={(e) => handleColumnRename(col, e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none transition font-semibold"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(previewData ? previewData.data.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE) : []).map((row, i) => {
                    const actualIndex = previewPage * PREVIEW_PAGE_SIZE + i;
                    return (
                    <tr key={actualIndex} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      {previewData.columns.map((col, j) => (
                        <td key={j} className="p-2 text-slate-600 max-w-xs truncate">
                          <input 
                            key={`cell-${actualIndex}-${col}`}
                            type="text" 
                            defaultValue={row[col] !== null && row[col] !== undefined ? String(row[col]) : ''} 
                            onBlur={(e) => handleCellChange(actualIndex, col, e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none transition"
                            title={String(row[col])}
                          />
                        </td>
                      ))}
                    </tr>
                  )})}
                </tbody>
              </table>
              {previewData.data.length === 0 && (
                <div className="p-12 text-center text-slate-500">No data available</div>
              )}
            </div>
            
            {/* Pagination Controls */}
            {previewData && previewData.data.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-500">
                  Showing {previewPage * PREVIEW_PAGE_SIZE + 1} to {Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, previewData.data.length)} of {previewData.data.length} rows
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPreviewPage(p => Math.max(0, p - 1))} 
                    disabled={previewPage === 0}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setPreviewPage(p => Math.min(Math.ceil(previewData.data.length / PREVIEW_PAGE_SIZE) - 1, p + 1))} 
                    disabled={previewPage >= Math.ceil(previewData.data.length / PREVIEW_PAGE_SIZE) - 1}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            {/* Excel-like Sheet Tabs */}
            {previewData && previewData.sheets && previewData.sheets.length > 1 && (
              <div className="flex items-center gap-1 px-4 pt-2 bg-slate-100 border-t border-slate-300 overflow-x-auto no-scrollbar shrink-0">
                {previewData.sheets.map(sheet => (
                  <button
                    key={sheet}
                    onClick={() => {
                      if (previewType === 'global') {
                        handlePreviewGlobalFile(previewTitle, sheet);
                      } else {
                        handlePreviewDataset(previewTitle, sheet);
                      }
                    }}
                    className={`px-6 py-2 text-sm font-medium rounded-t-xl transition whitespace-nowrap border-t border-x border-transparent ${previewData.current_sheet === sheet ? 'bg-white text-blue-600 shadow-sm !border-slate-300 z-10' : 'bg-transparent text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                  >
                    {sheet.replace(previewTitle.split('.')[0] + '_', '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
