import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { MessageSquare, Upload, Server, FileSpreadsheet, Paperclip, Send, PlusCircle, Trash2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [sessionId, setSessionId] = useState('');
  const [history, setHistory] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [globalFiles, setGlobalFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
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
      <div className="w-[380px] bg-slate-900 flex flex-col transition-all shrink-0">
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
                <li key={idx} className="flex items-center gap-3 text-[18px] bg-slate-800 text-slate-200 p-4 rounded-xl border border-slate-700 shadow-sm transition hover:bg-slate-700">
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
                  onClick={() => handleUseGlobalFile(file)}
                  className="flex items-center justify-between gap-3 text-[16px] bg-slate-800/80 text-slate-300 p-3 rounded-xl border border-transparent hover:border-slate-600 shadow-sm transition cursor-pointer hover:bg-slate-700 hover:text-white group"
                  title={`Click to load ${file} into current session`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <FileSpreadsheet size={18} className="text-blue-400 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                  <PlusCircle size={16} className="text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <div className="max-w-4xl mx-auto space-y-8 px-6">
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
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-slate-50 via-slate-50 md:via-slate-50/90 to-transparent pt-12 pb-8 px-6">
          <div className="max-w-4xl mx-auto relative flex flex-col bg-white border border-slate-300 shadow-xl shadow-slate-200/50 rounded-2xl focus-within:ring-2 ring-blue-500/50 transition-all duration-300">
            
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
            Powered by Gemini AI • Always verify results independently
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
