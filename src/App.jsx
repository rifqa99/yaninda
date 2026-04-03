import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  Heart, MapPin, Send, History, Users, BarChart3, LogOut, 
  CheckCircle2, Clock, ChevronRight, MessageSquare,
  Activity, AlertCircle, Check, Star, Trash2, ShieldCheck, Map, ToggleLeft, ToggleRight, TrendingUp, X
} from 'lucide-react';

// --- CONFIGURATION ---
const supabaseUrl = 'https://nncozxzldugbtxorgazb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uY296eHpsZHVnYnR4b3JnYXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzYzMTQsImV4cCI6MjA5MDU1MjMxNH0.Nz9uayFcVIXP58ewbkm5ZOBZQM3pvUK4-E5TJuFBcy0'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Chat Component ---
const ChatView = ({ requestId, role, name }) => {
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef();

  const fetchMsgs = useCallback(async () => {
    try {
      const { data } = await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at');
      setMessages(data || []);
    } catch (e) { console.error("Chat Error:", e); }
  }, [requestId]);

  useEffect(() => {
    fetchMsgs();
    const sub = supabase.channel(`chat-${requestId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [requestId, fetchMsgs]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMsg = async (text) => {
    if (!text.trim()) return;
    await supabase.from('messages').insert([{ request_id: requestId, sender_role: role, sender_name: name, content: text.trim() }]);
    setMsgInput('');
  };

  return (
    <div className="flex flex-col h-64 bg-slate-50 rounded-2xl overflow-hidden border mt-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_role === role ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] shadow-sm ${m.sender_role === role ? 'bg-pink-500 text-white border-transparent' : 'bg-white text-slate-700 border'}`}>
              <p className="text-[9px] opacity-60 font-bold">{m.sender_name}</p>
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-2 bg-white border-t flex gap-2">
        <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMsg(msgInput)} className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-pink-200" placeholder="Mesaj yaz..." />
        <button onClick={() => sendMsg(msgInput)} className="bg-pink-500 text-white p-2 rounded-full active:scale-90 transition-transform flex items-center justify-center"><Send size={16} /></button>
      </div>
    </div>
  );
};

export default function App() {
  // State Initialization
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('padpal_v_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [activeTab, setActiveTab] = useState(user ? 'volunteer' : 'request');
  const [requesterId, setRequesterId] = useState(() => localStorage.getItem('padpal_uid') || null);
  const [locations, setLocations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]); 
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewingChat, setViewingChat] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [systemMessage, setSystemMessage] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState("");

  const fetchData = useCallback(async (customUid = null) => {
    const targetUid = customUid || requesterId;
    try {
      let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
      if (!user && targetUid) query = query.eq('requester_id', targetUid);
      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);

      if (user?.is_admin) {
          const { data: vData } = await supabase.from('volunteers').select('*');
          setVolunteers(vData || []);
      }
    } catch (e) { console.error("Data error", e); }
  }, [user, requesterId]);

  const updateMonthlyCount = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('requester_id', uid).eq('status', 'Completed').gte('created_at', firstOfMonth);
      setMonthlyCount(count || 0);
    } catch (e) { console.error("Count Error", e); }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        let uid = localStorage.getItem('padpal_uid');
        if (!uid) {
          uid = Math.random().toString(36).substring(2, 10);
          localStorage.setItem('padpal_uid', uid);
          setRequesterId(uid);
        }
        const { data: locs } = await supabase.from('locations').select('*');
        setLocations(locs || []);
        await updateMonthlyCount(uid);
        await fetchData(uid); 
      } finally { setLoading(false); }
    };
    init();

    const sub = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
      fetchData();
      const storedUid = localStorage.getItem('padpal_uid');
      if (storedUid) updateMonthlyCount(storedUid);
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, () => {
        if (user?.is_admin) fetchData();
    }).subscribe();

    return () => supabase.removeChannel(sub);
  }, [fetchData, updateMonthlyCount]);

  const sendTelegram = async (location) => {
    try {
        await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location })
        });
    } catch (e) { console.error("Telegram Fail:", e); }
  };

  const handleRequest = async () => {
    if (monthlyCount >= 2 || !selectedLocation) return;
    const { error } = await supabase.from('requests').insert([{ location: selectedLocation, requester_id: requesterId, status: 'Pending' }]);
    if (!error) {
      sendTelegram(selectedLocation);
      setShowConfirmModal(false);
      setSelectedLocation("");
      fetchData();
    }
  };

  const updateVolunteerStatus = async (location, availability) => {
    if (!user) return;
    const { error } = await supabase.from('volunteers').update({ current_location: location, is_available: availability }).eq('username', user.username);
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
    if (!error) { setShowCancelModal(null); fetchData(); }
  };

  const handleConfirmReceipt = async (id) => {
    const { error } = await supabase.from('requests').update({ status: 'Completed' }).eq('id', id);
    if (!error) { await updateMonthlyCount(requesterId); fetchData(); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const u = formData.get('u')?.trim();
    const p = formData.get('p')?.trim();
    const { data } = await supabase.from('volunteers').select('*').eq('username', u).eq('password', p).maybeSingle();
    if (data) {
        localStorage.setItem('padpal_v_session', JSON.stringify(data));
        setUser(data);
        setActiveTab('volunteer');
        fetchData();
    } else { setLoginError('Giriş başarısız.'); }
  };

  const getAnalytics = () => {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    const cancelled = requests.filter(r => r.status === 'Cancelled').length;
    const locCounts = {};
    requests.forEach(r => locCounts[r.location] = (locCounts[r.location] || 0) + 1);
    const hotspots = Object.entries(locCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    return { total, completed, cancelled, hotspots };
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Heart className="text-pink-500 animate-pulse" size={48} fill="currentColor" />
      <p className="text-pink-500 text-xs font-black tracking-widest uppercase opacity-40 italic">Yanında...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 overflow-x-hidden selection:bg-pink-100">
      <header className="bg-white/80 backdrop-blur-md border-b px-5 py-3 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-pink-500" fill="currentColor" />
          <h1 className="text-lg font-black text-pink-600 tracking-tight">Yanında</h1>
        </div>
        <button onClick={() => user ? (localStorage.removeItem('padpal_v_session'), setUser(null), setActiveTab('request')) : setActiveTab('login')} className="text-slate-300 hover:text-pink-500 transition-colors">
          {user ? <LogOut size={20} /> : <Users size={20} />}
        </button>
      </header>

      {/* --- MODALS --- */}
      {systemMessage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center border scale-in-center">
            <CheckCircle2 className="text-pink-500 mx-auto mb-3" size={40} />
            <h4 className="font-black text-slate-800 text-lg mb-2">{systemMessage.title}</h4>
            <p className="text-sm text-slate-500 mb-6">{systemMessage.text}</p>
            <button onClick={() => setSystemMessage(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Tamam</button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl scale-in-center">
            <h4 className="font-black text-slate-800 text-lg mb-2">Onay</h4>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed"><span className="font-bold text-pink-500 underline">{selectedLocation}</span> konumuna yardım talebi gönderilsin mi?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleRequest} className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-pink-100 active:scale-95 transition-transform">Evet, İste</button>
              <button onClick={() => setShowConfirmModal(false)} className="w-full bg-slate-100 py-3 rounded-2xl text-slate-400 font-bold">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleCancelRequest} className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl scale-in-center overflow-y-auto max-h-[90vh]">
            <h4 className="font-black text-slate-800 text-lg mb-2 px-1">İptal Et</h4>
            <div className="space-y-2 mb-4 px-1">
              {["Çok bekledim", "Gerek kalmadı", "Yanlışlıkla oldu", "Diğer"].map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-all">
                  <input type="radio" name="reason" value={opt} required className="accent-pink-500" />
                  <span className="text-sm font-bold text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 px-1">
              <button type="submit" className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-xs">Onayla</button>
              <button type="button" onClick={() => setShowCancelModal(null)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-bold text-xs">Geri</button>
            </div>
          </form>
        </div>
      )}

      <main className="max-w-md mx-auto p-5 space-y-6">
        {activeTab === 'request' && (
          <>
            <div className="bg-gradient-to-br from-pink-500 to-rose-400 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight leading-none">Acil Yardım 🌸</h2>
                        <p className="text-pink-50 text-xs mt-2 opacity-90 font-medium italic">Ücretsiz ve anonim destek.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black bg-pink-600/50 px-2 py-1 rounded-lg uppercase">Limit</span>
                        <p className="text-xl font-black leading-none mt-1 tracking-tighter">{monthlyCount}/2</p>
                    </div>
                </div>
                <Heart className="absolute -right-4 -bottom-4 opacity-10 rotate-12" size={120} fill="white" />
            </div>

            <div className="space-y-4 bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konum Seç</p>
                <div className="relative">
                    <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="w-full bg-slate-50 p-4 pr-10 rounded-2xl font-bold text-sm outline-none border-none focus:ring-2 focus:ring-pink-200 transition-all appearance-none">
                        <option value="">Neredesin?</option>
                        {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none rotate-90" />
                </div>
                <button disabled={!selectedLocation || monthlyCount >= 2} onClick={() => setShowConfirmModal(true)} className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black shadow-xl disabled:grayscale disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-2"><Send size={18}/> Yardım İste</button>
            </div>

            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><History size={14}/> Geçmiş Taleplerim</h3>
                {requests.map(req => (
                    <div key={req.id} className="bg-white p-5 rounded-[32px] border border-slate-50 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center">
                            <div><p className="font-black text-sm text-slate-800 leading-tight">{req.location}</p><p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">{req.status}</p></div>
                            <div className="flex items-center gap-2">
                                {req.status === 'Pending' && <button onClick={() => setShowCancelModal(req)} className="bg-red-50 text-red-400 p-2 rounded-xl active:scale-90 transition-transform shadow-sm"><Trash2 size={16} /></button>}
                                {req.status === 'Delivered' && <button onClick={() => handleConfirmReceipt(req.id)} className="bg-green-500 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black shadow-lg shadow-green-100 active:scale-90 transition-all">Aldım ✅</button>}
                            </div>
                        </div>
                        {(req.status === 'Claimed' || req.status === 'Delivered') && (
                            <div className="mt-3 pt-3 border-t border-slate-50">
                                <button onClick={() => setViewingChat(viewingChat === req.id ? null : req.id)} className="w-full text-blue-600 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-blue-50 py-2.5 rounded-xl transition-all uppercase tracking-widest border border-blue-50">
                                    <MessageSquare size={14}/> {viewingChat === req.id ? 'Mesajları Kapat' : 'Gönüllü ile Yazış'}
                                </button>
                                {viewingChat === req.id && <ChatView requestId={req.id} role="student" name="Öğrenci" />}
                            </div>
                        )}
                    </div>
                ))}
                {requests.length === 0 && <p className="text-center text-slate-300 text-xs py-12 bg-white rounded-[32px] border-2 border-dashed border-slate-100 italic">Henüz geçmiş bir talebin yok.</p>}
            </div>
          </>
        )}

        {activeTab === 'login' && (
          <div className="bg-white p-10 rounded-[50px] border border-slate-100 shadow-2xl text-center space-y-6 mt-10 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-[24px] mx-auto flex items-center justify-center shadow-inner"><Users size={32} /></div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gönüllü Girişi</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && <div className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100">{loginError}</div>}
              <input name="u" placeholder="Kullanıcı Adı" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm" required />
              <input name="p" type="password" placeholder="Şifre" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm" required />
              <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-slate-100">Giriş Yap</button>
            </form>
            <button onClick={() => setActiveTab('request')} className="text-slate-400 text-[10px] font-black underline hover:text-pink-500 uppercase tracking-widest transition-colors">Öğrenci Görünümü</button>
          </div>
        )}

        {activeTab === 'volunteer' && user && (
          <section className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-xl space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div><h2 className="font-black text-slate-800 tracking-tight">Nöbet Durumu</h2><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{user.full_name}</p></div>
                    <button onClick={() => updateVolunteerStatus(user.current_location, !user.is_available)} className={`p-2 rounded-2xl transition-all ${user.is_available ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-300'}`}>
                        {user.is_available ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
                <select value={user.current_location || ""} onChange={(e) => updateVolunteerStatus(e.target.value, user.is_available)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none text-sm border-none focus:ring-2 focus:ring-pink-300 transition-all">
                    <option value="">Kampüs Dışı / Hareket Halinde</option>
                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                </select>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Gelen Çağrılar</p>
              {requests.filter(r => r.status === 'Pending').map(req => (
                <div key={req.id} className="bg-white p-5 rounded-[32px] border-2 border-pink-50 flex justify-between items-center shadow-lg animate-in zoom-in-95 transition-all">
                  <div><h3 className="font-black text-base text-slate-800">{req.location}</h3><p className="text-[9px] text-pink-500 font-black uppercase tracking-widest mt-0.5 animate-pulse">Bekliyor</p></div>
                  <button onClick={() => {
                    const activeTasks = requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name);
                    if (activeTasks.length > 0 && (Date.now() - new Date(req.created_at).getTime()) < 300000) {
                      setSystemMessage({ title: "Bekle", text: "Aynı anda sadece 1 görev alabilirsin (veya 5dk bekle)." }); return;
                    }
                    supabase.from('requests').update({ status: 'Claimed', volunteer_name: user.full_name }).eq('id', req.id).then(() => fetchData());
                  }} className="bg-pink-500 text-white px-8 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-pink-100">Görevi Al</button>
                </div>
              ))}
              {requests.filter(r => r.status === 'Pending').length === 0 && <p className="text-center text-slate-300 text-[11px] py-10 bg-white rounded-[32px] border-2 border-dashed border-slate-100 italic">Şu an açık talep yok.</p>}
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Aktif Görevlerim</p>
              {requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name).map(req => (
                <div key={req.id} className={`bg-white border border-blue-100 rounded-[40px] p-6 space-y-4 shadow-sm transition-all ${req.status === 'Delivered' ? 'opacity-80 grayscale-[30%]' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div><h3 className="font-black text-blue-600 text-base">{req.location}</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{req.status === 'Delivered' ? 'Onay Bekliyor' : 'Devam Ediyor'}</p></div>
                    <div className="flex gap-2">
                        {req.status === 'Claimed' && <button onClick={() => supabase.from('requests').update({ status: 'Delivered' }).eq('id', req.id).then(() => fetchData())} className="bg-green-500 text-white px-5 py-2.5 rounded-2xl active:scale-90 transition-all font-black text-xs shadow-lg shadow-green-100 flex items-center gap-2"><MapPin size={14}/> Vardım</button>}
                        {user.is_admin && req.status === 'Delivered' && (
                            <button onClick={() => handleConfirmReceipt(req.id)} className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl active:scale-90 transition-all font-black text-[10px] shadow-lg flex items-center gap-2 border border-slate-700 hover:bg-slate-800"><ShieldCheck size={14} className="text-pink-400" /> Zorunlu Onay</button>
                        )}
                    </div>
                  </div>
                  <ChatView requestId={req.id} role="volunteer" name={user.full_name} />
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'admin' && user?.is_admin && (
          <section className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[40px] text-white shadow-2xl flex justify-between items-center">
              <div><h2 className="font-black text-xl tracking-tight">Yönetici Paneli</h2><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 opacity-70">Operasyonel Veriler</p></div>
              <BarChart3 className="text-pink-500" size={28} />
            </div>

            <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Map size={14} className="text-pink-500"/> Ekip Haritası</h3>
                <div className="space-y-3">
                    {volunteers.filter(v => v.is_available).map(v => (
                        <div key={v.full_name} className="flex justify-between items-center p-3 bg-green-50 rounded-2xl border border-green-100 animate-in zoom-in-95">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-black text-xs shadow-sm">{v.full_name.charAt(0).toUpperCase()}</div>
                                <div><p className="text-xs font-black text-slate-700">{v.full_name}</p><p className="text-[9px] text-green-600 font-bold flex items-center gap-1"><MapPin size={10}/> {v.current_location || "Kampüs"}</p></div>
                            </div>
                            <span className="text-[8px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Müsait</span>
                        </div>
                    ))}
                    {volunteers.filter(v => v.is_available).length === 0 && <p className="text-center text-slate-300 text-[11px] py-4 italic font-medium">Şu an aktif gönüllü yok.</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 text-center">
                    <p className="text-3xl font-black text-slate-800">{getAnalytics().total}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Toplam Talep</p>
                </div>
                <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 text-center">
                    <p className="text-3xl font-black text-green-500">{getAnalytics().completed}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Başarılı</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={14} className="text-pink-500"/> Popüler Konumlar</h3>
                <div className="space-y-4">
                    {getAnalytics().hotspots.map(([loc, count]) => (
                        <div key={loc} className="space-y-1.5">
                            <div className="flex justify-between items-end px-1">
                                <span className="text-xs font-bold text-slate-700">{loc}</span>
                                <span className="text-[10px] font-black text-pink-50">{count} reqs</span>
                            </div>
                            <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <div className="bg-pink-500 h-full rounded-full transition-all duration-1000" style={{ width: `${getAnalytics().total > 0 ? (count / getAnalytics().total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-6 left-10 right-10 bg-white/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-4 flex justify-around items-center z-50 rounded-[2.5rem] ring-1 ring-black/5">
        <button onClick={() => setActiveTab('request')} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'request' ? 'text-pink-500 scale-110 font-black' : 'text-slate-300 font-bold'}`}>
          <Heart size={24} fill={activeTab === 'request' ? "currentColor" : "none"} />
          <span className="text-[9px] uppercase tracking-widest">Destek</span>
        </button>
        {(user || activeTab === 'volunteer') && (
          <button onClick={() => setActiveTab('volunteer')} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'volunteer' ? 'text-pink-500 scale-110 font-black' : 'text-slate-300 font-bold'}`}>
            <Clock size={24} fill={activeTab === 'volunteer' ? "currentColor" : "none"} />
            <span className="text-[9px] uppercase tracking-widest">Görevler</span>
          </button>
        )}
        {user?.is_admin && (
          <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'admin' ? 'text-pink-500 scale-110 font-black' : 'text-slate-300 font-bold'}`}>
            <BarChart3 size={24} />
            <span className="text-[9px] uppercase tracking-widest">Veri</span>
          </button>
        )}
      </nav>
    </div>
  );
}