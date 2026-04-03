import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Heart, MapPin, Send, History, Users, BarChart3, LogOut,
  CheckCircle2, Clock, ChevronRight, ShieldAlert, MessageSquare,
  Activity, AlertCircle, Check, Star, X, Trash2, ShieldCheck, PieChart, TrendingUp,
  Map, UserCheck, ToggleLeft, ToggleRight
} from 'lucide-react';

// --- CONFIGURATION ---
const supabaseUrl = 'https://ewhoouptqrtesardpsqh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3aG9vdXB0cXJ0ZXNhcmRwc3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDg4NTIsImV4cCI6MjA5MDc4NDg1Mn0.BdAeT63Fk3GgHS_Diy6P9RcJVClttwLNB2blY2azP9s'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Sohbet Bileşeni ---
const ChatView = ({ requestId, role, name }) => {
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef();

  const fetchMsgs = useCallback(async () => {
    try {
      const { data } = await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at');
      setMessages(data || []);
    } catch (e) { console.error("Sohbet Hatası:", e); }
  }, [requestId]);

  useEffect(() => {
    fetchMsgs();
    const sub = supabase.channel(`chat-${requestId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` }, (payload) => {
        setMessages(prev => (prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [requestId, fetchMsgs]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMsg = async (text) => {
    if (!text.trim()) return;
    const { error } = await supabase.from('messages').insert([{ request_id: requestId, sender_role: role, sender_name: name, content: text.trim() }]);
    if (!error) setMsgInput('');
  };

  return (
    <div className="flex flex-col h-72 bg-slate-50/50 rounded-[30px] overflow-hidden border border-slate-100 mt-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_role === role ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-[20px] text-[13px] shadow-sm ${m.sender_role === role ? 'bg-pink-500 text-white' : 'bg-white text-slate-700 border border-slate-50'}`}>
              <p className="text-[9px] opacity-60 mb-0.5 font-bold">{m.sender_name}</p>
              <p className="leading-tight">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-3 bg-white/80 border-t border-slate-100 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['Yoldayım!', 'Kapıdayım', 'Bekliyorum', 'Teşekkürler!'].map(q => (
            <button key={q} onClick={() => sendMsg(q)} className="text-[10px] bg-slate-50 px-3 py-1.5 rounded-full whitespace-nowrap text-slate-500 border border-slate-100 active:bg-pink-50 transition-colors">{q}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={msgInput} onChange={e => setMsgInput(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-pink-100 outline-none transition-all" placeholder="Mesaj yaz..." onKeyPress={e => e.key === 'Enter' && sendMsg(msgInput)} />
          <button onClick={() => sendMsg(msgInput)} className="bg-pink-500 text-white p-2.5 rounded-full active:scale-90 transition-transform shadow-lg shadow-pink-100 flex items-center justify-center"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('padpal_v_session') || 'null'));
  const [activeTab, setActiveTab] = useState(user ? 'volunteer' : 'request');
  const [requesterId, setRequesterId] = useState(() => localStorage.getItem('padpal_uid') || null);
  const [locations, setLocations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewingChat, setViewingChat] = useState(null);
  const [loginError, setLoginError] = useState('');
 
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [showEvalModal, setShowEvalModal] = useState(null);
  const [systemMessage, setSystemMessage] = useState(null);

  const fetchData = useCallback(async (customUid = null) => {
    const targetUid = customUid || requesterId;
    if (!targetUid && !user) return;
   
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (!user) {
        query = query.eq('requester_id', targetUid);
    }
   
    const { data } = await query;
    setRequests(data || []);

    if (user?.is_admin) {
        const { data: vData } = await supabase.from('volunteers').select('full_name, current_location, is_available');
        setVolunteers(vData || []);
    }
  }, [user, requesterId]);

  const updateMonthlyCount = useCallback(async (uid) => {
    if (!uid) return;
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { count } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('requester_id', uid).eq('status', 'Completed').gte('created_at', firstOfMonth);
    setMonthlyCount(count || 0);
  }, []);

  // INITIALIZATION AND REFINED REALTIME SYNC
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);

    const init = async () => {
      let uid = requesterId;
      if (!uid) {
        uid = Math.random().toString(36).substring(2, 10);
        localStorage.setItem('padpal_uid', uid);
        setRequesterId(uid);
      }
     
      const { data: locs } = await supabase.from('locations').select('*');
      setLocations(locs || []);
     
      await Promise.all([
        updateMonthlyCount(uid),
        fetchData(uid)
      ]);
     
      setLoading(false);
    };
    init();

    // PRODUCTION-LEVEL REALTIME: Direct state updates without refetching
    const requestsSub = supabase.channel('yaninda-dynamic-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        // If student view, only add if it belongs to them. If volunteer view, add always.
        const isOwner = payload.new.requester_id === requesterId;
        if (user || isOwner) {
          setRequests(prev => [payload.new, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' }, (payload) => {
        setRequests(prev => prev.map(req => req.id === payload.new.id ? payload.new : req));
        // If status changed to Completed, update the local counter if it's the current student
        if (payload.new.status === 'Completed' && payload.new.requester_id === requesterId) {
          updateMonthlyCount(requesterId);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'requests' }, (payload) => {
        setRequests(prev => prev.filter(req => req.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, () => {
        if (user?.is_admin) fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(requestsSub); };
  }, [fetchData, updateMonthlyCount, requesterId, user]);

  const sendTelegram = async (location) => {
    try {
        await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location })
        });
    } catch (e) { console.error("Telegram bildirimi başarısız", e); }
  };

  const handleRequest = async () => {
    if (monthlyCount >= 2 || !selectedLocation) return;
    const { error } = await supabase.from('requests').insert([{ location: selectedLocation, requester_id: requesterId, status: 'Pending' }]);
    if (!error) {
      sendTelegram(selectedLocation);
      setShowConfirmModal(false);
      setSelectedLocation("");
      // fetchData() is no longer strictly needed here because Realtime INSERT will catch it
    }
  };

  const updateVolunteerStatus = async (location, availability) => {
    if (!user) return;
    const { error } = await supabase.from('volunteers').update({
        current_location: location,
        is_available: availability
    }).eq('username', user.username);
   
    if (!error) {
        const updatedUser = { ...user, current_location: location, is_available: availability };
        setUser(updatedUser);
        localStorage.setItem('padpal_v_session', JSON.stringify(updatedUser));
    }
  };

  const handleCancelRequest = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason');
    if (!reason) return;
    const { error } = await supabase.from('requests').update({ status: 'Cancelled', cancellation_reason: reason }).eq('id', showCancelModal.id);
    if (!error) { setShowCancelModal(null); }
  };

  const handleEvaluation = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const evalData = { vol: formData.get('vol'), qual: formData.get('qual'), serv: formData.get('serv'), note: formData.get('note') };
    await supabase.from('requests').update({ evaluation: evalData }).eq('id', showEvalModal);
    setShowEvalModal(null);
    setSystemMessage({ title: "Teşekkürler", text: "Geri bildiriminiz iletildi!" });
  };

  const handleConfirmReceipt = async (id) => {
    const { error } = await supabase.from('requests').update({ status: 'Completed' }).eq('id', id);
    if (!error) { setShowEvalModal(id); }
  };

  const getAnalytics = () => {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    const cancelled = requests.filter(r => r.status === 'Cancelled').length;
    const locCounts = {};
    requests.forEach(r => locCounts[r.location] = (locCounts[r.location] || 0) + 1);
    const hotspots = Object.entries(locCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const volCounts = {};
    requests.filter(r => r.status === 'Completed').forEach(r => { if(r.volunteer_name) volCounts[r.volunteer_name] = (volCounts[r.volunteer_name] || 0) + 1; });
    const topVols = Object.entries(volCounts).sort((a,b) => b[1] - a[1]);
    return { total, completed, cancelled, hotspots, topVols };
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Heart className="text-pink-500 animate-pulse" size={60} fill="currentColor" />
      <p className="text-pink-600 text-sm font-black tracking-widest uppercase opacity-40 italic">Yanında...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 font-sans pb-32 overflow-x-hidden selection:bg-pink-100">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-50 px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-pink-500 p-1.5 rounded-xl shadow-lg shadow-pink-200">
            <Heart size={18} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tighter leading-none">Yanında</h1>
        </div>
        <button onClick={() => user ? (localStorage.removeItem('padpal_v_session'), setUser(null), setActiveTab('request')) : setActiveTab('login')} className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-pink-500 transition-all duration-300">
          {user ? <LogOut size={20} /> : <Users size={20} />}
        </button>
      </header>

      {/* --- MODALS (Premium Smooth Design) --- */}
      {systemMessage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center border border-white scale-in-center">
            <CheckCircle2 className="text-pink-500 mx-auto mb-3" size={40} />
            <h4 className="font-black text-slate-800 text-xl mb-2">{systemMessage.title}</h4>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">{systemMessage.text}</p>
            <button onClick={() => setSystemMessage(null)} className="w-full bg-slate-900 text-white py-4 rounded-3xl font-black shadow-xl active:scale-95 transition-all">Tamam</button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[45px] p-8 shadow-2xl scale-in-center border border-white">
            <h4 className="font-black text-slate-800 text-xl mb-3 text-center">Talebi Onayla</h4>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed text-center font-medium">Yardım talebiniz <span className="font-bold text-pink-500 underline underline-offset-4 decoration-pink-100">{selectedLocation}</span> konumuna gönderilecek. Onaylıyor musunuz?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleRequest} className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-pink-200 active:scale-95 transition-all">Evet, İstiyorum</button>
              <button onClick={() => setShowConfirmModal(false)} className="w-full bg-slate-50 text-slate-400 py-3.5 rounded-3xl font-bold active:scale-95">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleCancelRequest} className="bg-white w-full max-w-xs rounded-[45px] p-8 shadow-2xl scale-in-center">
            <h4 className="font-black text-slate-800 text-xl mb-6 text-center">İptal Sebebi</h4>
            <div className="space-y-3 mb-8">
              {["Çok bekledim", "Gerek kalmadı", "Yanlışlıkla oldu", "Diğer"].map((opt) => (
                <label key={opt} className="flex items-center gap-4 p-4 bg-slate-50 rounded-[25px] border border-slate-100 cursor-pointer hover:bg-pink-50 active:scale-95 transition-all">
                  <input type="radio" name="reason" value={opt} required className="accent-pink-500 w-5 h-5" />
                  <span className="text-sm font-bold text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-red-500 text-white py-4 rounded-3xl font-black shadow-lg">Onayla</button>
              <button type="button" onClick={() => setShowCancelModal(null)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-3xl font-bold">Geri</button>
            </div>
          </form>
        </div>
      )}

      {showEvalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleEvaluation} className="bg-white w-full max-w-sm rounded-[45px] p-10 shadow-2xl scale-in-center my-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner"><Heart size={32} fill="currentColor" /></div>
              <h4 className="text-2xl font-black text-slate-800">Tamamlandı!</h4>
              <p className="text-slate-400 text-sm font-bold opacity-70">Deneyiminiz nasıldı?</p>
            </div>
            <div className="space-y-6 mb-8 text-left">
              {[ {label: 'Gönüllü', key: 'vol'}, {label: 'Hizmet', key: 'serv'} ].map((item) => (
                <div key={item.key}>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">{item.label}</p>
                  <div className="flex justify-between px-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <label key={num} className="cursor-pointer">
                        <input type="radio" name={item.key} value={num} required className="hidden peer" />
                        <Star size={30} className="text-slate-200 peer-checked:text-pink-500 peer-checked:fill-pink-500 transition-all hover:scale-110" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <textarea name="note" placeholder="Eklemek istediğiniz bir not..." className="w-full p-4 bg-slate-50 rounded-3xl text-sm h-24 border-none focus:ring-2 focus:ring-pink-100" />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[25px] font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">Geri Bildirim Gönder</button>
          </form>
        </div>
      )}

      <main className="max-w-md mx-auto p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'request' && (
          <>
            <div className="bg-gradient-to-br from-pink-500 to-rose-400 p-8 rounded-[45px] text-white shadow-2xl shadow-pink-200 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-start">
                    <div className="max-w-[70%]">
                        <h2 className="text-2xl font-black tracking-tight leading-none mb-2 flex items-center gap-2">
                          Acil Yardım <span className="text-lg">🌸</span>
                        </h2>
                        <p className="text-pink-50 text-[13px] opacity-90 font-medium leading-tight">
                          Ücretsiz & anonim destek ağı.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/20 mb-1 inline-block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/90">LİMİT</span>
                        </div>
                        <p className="text-3xl font-black leading-none tracking-tighter">{monthlyCount}/2</p>
                    </div>
                </div>
                <Heart className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={130} fill="white" />
            </div>

            <div className="text-center">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">KONUMUNU SEÇ</p>
              <div className="space-y-4 bg-white p-7 rounded-[40px] border border-slate-100 shadow-sm relative group">
                  <div className="relative">
                      <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="w-full bg-slate-50 p-5 pr-12 rounded-[25px] font-bold text-slate-700 outline-none border-none focus:ring-4 focus:ring-pink-50 transition-all appearance-none text-base">
                          <option value="">Neredesin?</option>
                          {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                      </select>
                      <ChevronRight size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none rotate-90" />
                  </div>
                  <button 
                    disabled={!selectedLocation || monthlyCount >= 2} 
                    onClick={() => setShowConfirmModal(true)} 
                    className="w-full bg-pink-500 text-white py-5 rounded-[30px] font-black text-lg shadow-2xl shadow-pink-200 disabled:grayscale disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Send size={20}/> Şimdi İste
                  </button>
              </div>
            </div>

            {/* REQUEST HISTORY LIST */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 ml-3">
                    <History size={16} className="text-slate-400"/>
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">GEÇMİŞ TALEPLERİM</h3>
                    <button onClick={() => fetchData()} className="ml-auto p-2 text-slate-300 hover:text-pink-500 transition-colors"><Activity size={14}/></button>
                </div>
                {requests.map(req => (
                    <div key={req.id} className="bg-white p-5 rounded-[45px] border border-slate-50 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-inner ${req.status === 'Completed' ? 'bg-green-50 text-green-500' : req.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : 'bg-pink-50 text-pink-500'}`}>
                                    {req.status === 'Completed' ? <CheckCircle2 size={24}/> : req.status === 'Cancelled' ? <X size={24}/> : <Clock size={24}/>}
                                </div>
                                <div>
                                    <p className="font-black text-base text-slate-800 leading-none mb-1.5">{req.location}</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${req.status === 'Pending' ? 'text-amber-500 animate-pulse' : req.status === 'Claimed' ? 'text-blue-500' : req.status === 'Delivered' ? 'text-purple-600' : 'text-slate-400'}`}>
                                      {req.status === 'Delivered' ? 'Kapıda 📍' : req.status === 'Claimed' ? 'Gönüllü Yolda' : req.status === 'Pending' ? 'Bekliyor' : req.status === 'Cancelled' ? 'İptal Edildi' : 'Tamamlandı'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {req.status === 'Pending' && <button onClick={() => setShowCancelModal(req)} className="bg-red-50 text-red-400 p-3 rounded-full active:scale-90 transition-transform shadow-sm"><Trash2 size={20} /></button>}
                                {req.status === 'Delivered' && <button onClick={() => handleConfirmReceipt(req.id)} className="bg-green-500 text-white px-6 py-3.5 rounded-[22px] text-xs font-black shadow-lg shadow-green-100 active:scale-90 transition-all uppercase">ALDIM ✅</button>}
                            </div>
                        </div>
                        {(req.status === 'Claimed' || req.status === 'Delivered') && (
                            <div className="mt-4 pt-4 border-t border-slate-50">
                                <button onClick={() => setViewingChat(viewingChat === req.id ? null : req.id)} className="w-full text-blue-600 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-blue-50 py-3.5 rounded-[22px] transition-all uppercase tracking-[0.15em] border border-blue-50 bg-blue-50/20">
                                    <MessageSquare size={16}/> {viewingChat === req.id ? 'Sohbeti Kapat' : 'Gönüllü ile Yazış'}
                                </button>
                                {viewingChat === req.id && <ChatView requestId={req.id} role="requester" name="Siz" />}
                            </div>
                        )}
                    </div>
                ))}
                {requests.length === 0 && (
                    <div className="text-center py-16 bg-white/50 rounded-[45px] border border-dashed border-slate-100 font-medium italic text-slate-300">
                        Henüz bir talebiniz yok.
                    </div>
                )}
            </div>
          </>
        )}

        {/* --- LOGIN VIEW --- */}
        {activeTab === 'login' && (
          <div className="bg-white p-12 rounded-[60px] border border-slate-50 shadow-2xl text-center space-y-8 mt-10 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-pink-50 text-pink-500 rounded-[30px] mx-auto flex items-center justify-center shadow-inner"><Users size={40} /></div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Gönüllü Girişi</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              const formData = new FormData(e.currentTarget);
              const u = formData.get('u')?.trim();
              const p = formData.get('p')?.trim();
              const { data, error } = await supabase.from('volunteers').select('*').eq('username', u).eq('password', p).maybeSingle();
              if (data) {
                localStorage.setItem('padpal_v_session', JSON.stringify(data));
                setUser(data);
                setActiveTab('volunteer');
                fetchData();
              } else { setLoginError('Giriş başarısız.'); }
            }} className="space-y-4">
              {loginError && <div className="text-xs text-red-500 font-bold bg-red-50 p-4 rounded-[20px] border border-red-100 leading-relaxed">{loginError}</div>}
              <input name="u" placeholder="Kullanıcı Adı" className="w-full p-5 bg-slate-50 rounded-[25px] font-bold border-none focus:ring-4 focus:ring-pink-50 transition-all shadow-sm" required />
              <input name="p" type="password" placeholder="Şifre" className="w-full p-5 bg-slate-50 rounded-[25px] font-bold border-none focus:ring-4 focus:ring-pink-50 transition-all shadow-sm" required />
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[30px] font-black text-lg active:scale-95 transition-all shadow-2xl shadow-slate-200 mt-2">Giriş Yap</button>
            </form>
            <button onClick={() => setActiveTab('request')} className="text-slate-400 text-[11px] font-black underline hover:text-pink-500 uppercase tracking-widest transition-colors duration-300">Öğrenci Görünümü</button>
          </div>
        )}

        {/* --- VOLUNTEER VIEW --- */}
        {activeTab === 'volunteer' && user && (
          <section className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[50px] border border-slate-100 shadow-xl space-y-6">
                <div className="flex justify-between items-center px-1">
                    <div>
                        <h2 className="font-black text-2xl text-slate-800 tracking-tighter">Ekip Masası</h2>
                        <p className="text-[10px] text-pink-500 uppercase font-black tracking-widest">{user.full_name}</p>
                    </div>
                    <button onClick={() => updateVolunteerStatus(user.current_location, !user.is_available)} className={`p-1 rounded-[20px] transition-all duration-500 ${user.is_available ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-200'}`}>
                        {user.is_available ? <ToggleRight size={48} /> : <ToggleLeft size={48} />}
                    </button>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Konumum</p>
                    <select value={user.current_location || ""} onChange={(e) => updateVolunteerStatus(e.target.value, user.is_available)} className="w-full bg-slate-50 p-5 rounded-[25px] font-bold text-slate-700 outline-none border-none focus:ring-4 focus:ring-pink-50 transition-all appearance-none shadow-sm">
                        <option value="">Kampüs Dışı / Yolda</option>
                        {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Gelen Çağrılar</p>
              {requests.filter(r => r.status === 'Pending').map(req => (
                <div key={req.id} className="bg-white p-6 rounded-[45px] border-2 border-pink-50 flex justify-between items-center shadow-xl shadow-pink-500/5 animate-in zoom-in-95 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-50 text-pink-50 rounded-2xl flex items-center justify-center animate-pulse"><MapPin size={24}/></div>
                    <div><h3 className="font-black text-lg text-slate-800 leading-none">{req.location}</h3><p className="text-[10px] text-pink-500 font-black tracking-widest mt-1.5 uppercase">Destek Bekliyor</p></div>
                  </div>
                  <button onClick={() => {
                    const activeTasks = requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name);
                    if (activeTasks.length > 0 && (Date.now() - new Date(req.created_at).getTime()) < 300000) {
                      setSystemMessage({ title: "Mola!", text: "Aynı anda sadece bir yardım görevi alabilirsin." }); return;
                    }
                    supabase.from('requests').update({ status: 'Claimed', volunteer_name: user.full_name }).eq('id', req.id).then(() => fetchData());
                  }} className="bg-pink-500 text-white px-8 py-4 rounded-[25px] font-black text-sm active:scale-95 shadow-2xl shadow-pink-200 transition-all uppercase">Görevi Al</button>
                </div>
              ))}
              {requests.filter(r => r.status === 'Pending').length === 0 && <p className="text-center text-slate-300 text-[11px] py-10 bg-white/50 rounded-[45px] border-2 border-dashed border-slate-100 italic">Aktif çağrı yok.</p>}
            </div>

            <div className="space-y-5">
              <p className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Aktif Görevlerim</p>
              {requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name).map(req => (
                <div key={req.id} className={`bg-white border border-blue-50 rounded-[50px] p-8 space-y-6 shadow-sm transition-all duration-700 ${req.status === 'Delivered' ? 'opacity-70 saturate-50' : 'shadow-blue-500/5'}`}>
                  <div className="flex justify-between items-center">
                    <div><h3 className="font-black text-blue-600 text-xl tracking-tighter leading-none mb-2">{req.location}</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{req.status === 'Delivered' ? 'Onay Bekliyor' : 'Yoldasınız'}</p></div>
                    <div className="flex gap-2">
                        {req.status === 'Claimed' && <button onClick={() => supabase.from('requests').update({ status: 'Delivered' }).eq('id', req.id).then(() => fetchData())} className="bg-green-500 text-white px-6 py-3.5 rounded-[22px] active:scale-90 transition-all font-black text-xs shadow-xl shadow-green-100 flex items-center gap-2"><MapPin size={16}/> Vardım</button>}
                        {user.is_admin && req.status === 'Delivered' && (
                            <button onClick={() => handleConfirmReceipt(req.id)} className="bg-slate-900 text-white px-5 py-3.5 rounded-[22px] active:scale-90 transition-all font-black text-[10px] shadow-xl flex items-center gap-2 border border-slate-700 hover:bg-slate-800"><ShieldCheck size={16} className="text-pink-400" /> Admin Onayı</button>
                        )}
                    </div>
                  </div>
                  <ChatView requestId={req.id} role="volunteer" name={user.full_name} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- ADMIN VIEW --- */}
        {activeTab === 'admin' && user?.is_admin && (
          <section className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-[60px] text-white shadow-2xl flex justify-between items-center ring-8 ring-slate-100">
              <div><h2 className="text-3xl font-black tracking-tighter mb-2">Analizler</h2><p className="text-[11px] text-slate-400 uppercase font-black tracking-[0.2em] opacity-80">Canlı Operasyon Verileri</p></div>
              <BarChart3 className="text-pink-500" size={40} />
            </div>

            <div className="bg-white p-8 rounded-[50px] shadow-sm border border-slate-50">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><Map size={18} className="text-pink-500"/> Kampüs Ekip Haritası</h3>
                <div className="space-y-4">
                    {volunteers.filter(v => v.is_available).map(v => (
                        <div key={v.full_name} className="flex justify-between items-center p-4 bg-green-50/50 rounded-[30px] border border-green-100 animate-in zoom-in-95">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-500 text-white rounded-[20px] flex items-center justify-center font-black text-lg shadow-lg shadow-green-100">{v.full_name.charAt(0).toUpperCase()}</div>
                                <div><p className="text-base font-black text-slate-700 leading-none mb-1.5">{v.full_name}</p><p className="text-[10px] text-green-600 font-bold flex items-center gap-1.5"><MapPin size={12}/> {v.current_location || "Kampüs İçi"}</p></div>
                            </div>
                            <span className="text-[9px] font-black bg-green-500 text-white px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">Müsait</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[45px] shadow-sm border border-slate-100 text-center">
                    <p className="text-4xl font-black text-slate-800 tracking-tighter mb-2">{getAnalytics().total}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toplam Talep</p>
                </div>
                <div className="bg-white p-8 rounded-[45px] shadow-sm border border-slate-100 text-center">
                    <p className="text-4xl font-black text-green-500 tracking-tighter mb-2">{getAnalytics().completed}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Başarılı Yardım</p>
                </div>
            </div>

            <div className="bg-white p-10 rounded-[55px] shadow-sm border border-slate-100">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><TrendingUp size={18} className="text-pink-500"/> Lokasyon Bazlı Talep</h3>
                <div className="space-y-6">
                    {getAnalytics().hotspots.map(([loc, count]) => (
                        <div key={loc} className="space-y-2.5">
                            <div className="flex justify-between items-end px-2">
                                <span className="text-sm font-black text-slate-700">{loc}</span>
                                <span className="text-[11px] font-black text-pink-500 bg-pink-50 px-2.5 py-1 rounded-lg">{count} talep</span>
                            </div>
                            <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-100">
                                <div className="bg-gradient-to-r from-pink-500 to-rose-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${getAnalytics().total > 0 ? (count / getAnalytics().total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </section>
        )}
      </main>

      {/* NAVIGATION BAR (GLOSSY DESIGN) */}
      <nav className="fixed bottom-8 left-8 right-8 bg-white/80 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-white/40 p-5 flex justify-around items-center z-50 rounded-[40px] ring-1 ring-black/5">
        <button onClick={() => setActiveTab('request')} className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${activeTab === 'request' ? 'text-pink-500 scale-125 font-black drop-shadow-sm' : 'text-slate-300'}`}>
          <Heart size={26} fill={activeTab === 'request' ? "currentColor" : "none"} />
          <span className="text-[10px] uppercase font-black tracking-widest">DESTEK</span>
        </button>
        {(user || activeTab === 'volunteer') && (
          <button onClick={() => setActiveTab('volunteer')} className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${activeTab === 'volunteer' ? 'text-pink-500 scale-125 font-black drop-shadow-sm' : 'text-slate-300'}`}>
            <Clock size={26} fill={activeTab === 'volunteer' ? "currentColor" : "none"} />
            <span className="text-[10px] uppercase font-black tracking-widest">GÖREV</span>
          </button>
        )}
        {user?.is_admin && (
          <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${activeTab === 'admin' ? 'text-pink-500 scale-125 font-black drop-shadow-sm' : 'text-slate-300'}`}>
            <BarChart3 size={26} />
            <span className="text-[10px] uppercase font-black tracking-widest">VERİ</span>
          </button>
        )}
      </nav>
    </div>
  );
}