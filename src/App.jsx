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
    const { data } = await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at');
    setMessages(data || []);
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
    <div className="flex flex-col h-72 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 mt-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_role === role ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] shadow-sm ${m.sender_role === role ? 'bg-pink-500 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}>
              <p className="text-[9px] opacity-60 mb-0.5 font-bold">{m.sender_name}</p>
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-2 bg-white border-t border-slate-100 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['Yoldayım!', 'Kapıdayım', 'Teşekkürler!'].map(q => (
            <button key={q} onClick={() => sendMsg(q)} className="text-[10px] bg-slate-50 px-3 py-1.5 rounded-full whitespace-nowrap text-slate-500 border border-slate-100 active:bg-pink-50 transition-colors">{q}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={msgInput} onChange={e => setMsgInput(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-pink-300 outline-none" placeholder="Mesaj yaz..." onKeyPress={e => e.key === 'Enter' && sendMsg(msgInput)} />
          <button onClick={() => sendMsg(msgInput)} className="bg-pink-500 text-white p-2 rounded-full active:scale-90 transition-transform"><Send size={16} /></button>
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
   
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (!user) {
        if (!targetUid) return;
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

    const requestsSub = supabase.channel('global-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
      fetchData();
      const storedUid = localStorage.getItem('padpal_uid');
      if (storedUid) updateMonthlyCount(storedUid);
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, () => {
        if (user?.is_admin) fetchData();
    }).subscribe();

    return () => { supabase.removeChannel(requestsSub); };
  }, [fetchData, updateMonthlyCount, requesterId, user?.is_admin]);

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
      fetchData();
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
    const other = formData.get('other_reason') || "";
    if (!reason) return;
    const requestTime = new Date(showCancelModal.created_at).getTime();
    const waitTime = Math.floor((Date.now() - requestTime) / 60000);
    let finalReason = `${reason} (${waitTime}dk)`;
    if (reason === "Çok bekledim" && waitTime < 5) finalReason += " [Erken]";
    if (other) finalReason += ` | ${other}`;
    const { error } = await supabase.from('requests').update({ status: 'Cancelled', cancellation_reason: finalReason }).eq('id', showCancelModal.id);
    if (!error) { setShowCancelModal(null); fetchData(); }
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
    if (!error) { await updateMonthlyCount(requesterId); fetchData(); setShowEvalModal(id); }
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Heart className="text-pink-500 animate-pulse" size={40} fill="currentColor" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 selection:bg-pink-100 overflow-x-hidden">
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
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl scale-in-center">
            <h4 className="font-black text-slate-800 text-lg mb-2 text-center">Talebi Onayla</h4>
            <p className="text-sm text-slate-500 mb-6 italic text-center"><span className="font-bold text-pink-500 underline">{selectedLocation}</span> konumuna yardım talebi gönderilsin mi?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleRequest} className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-transform">Evet, yardım iste</button>
              <button onClick={() => setShowConfirmModal(false)} className="w-full bg-slate-100 text-slate-400 py-3 rounded-2xl font-bold text-sm transition-colors hover:bg-slate-200">Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleCancelRequest} className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl scale-in-center overflow-y-auto max-h-[90vh]">
            <h4 className="font-black text-slate-800 text-lg mb-2 px-1 text-center">İptal Et</h4>
            <div className="space-y-2 mb-4 px-1">
              {["Çok bekledim", "Gönüllü gelmedi", "Yanlışlıkla istedim", "Diğer"].map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-pink-50 active:scale-95 transition-all">
                  <input type="radio" name="reason" value={opt} required className="accent-pink-500 w-4 h-4" />
                  <span className="text-sm font-bold text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
            <textarea name="other_reason" placeholder="Detaylar..." className="w-full p-4 bg-slate-50 rounded-2xl text-sm mb-4 h-24 outline-none border-none focus:ring-2 focus:ring-pink-300 font-medium" />
            <div className="flex gap-2 px-1">
              <button type="submit" className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all">Onayla</button>
              <button type="button" onClick={() => setShowCancelModal(null)} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-bold text-xs">Geri</button>
            </div>
          </form>
        </div>
      )}

      {showEvalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleEvaluation} className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl scale-in-center my-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner"><Heart size={32} fill="currentColor" /></div>
              <h4 className="text-2xl font-black text-slate-800">Tamamlandı!</h4>
              <p className="text-slate-400 text-sm font-bold opacity-70 text-center">Deneyiminiz nasıldı?</p>
            </div>
            <div className="space-y-6 mb-8 text-left">
              {[ {label: 'Gönüllü', key: 'vol'}, {label: 'Ürün Kalitesi', key: 'qual'}, {label: 'Hizmet', key: 'serv'} ].map((item) => (
                <div key={item.key}>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">{item.label}</p>
                  <div className="flex justify-between px-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <label key={num} className="cursor-pointer">
                        <input type="radio" name={item.key} value={num} required className="hidden peer" />
                        <Star size={28} className="text-slate-200 peer-checked:text-pink-500 peer-checked:fill-pink-500 transition-all hover:scale-110" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <textarea name="note" placeholder="Eklemek istediğiniz not..." className="w-full p-4 bg-slate-50 rounded-3xl text-sm h-24 border-none focus:ring-2 focus:ring-pink-300" />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[25px] font-black shadow-xl active:scale-95 transition-all">Geri Bildirim Gönder</button>
          </form>
        </div>
      )}

      {systemMessage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center">
            <CheckCircle2 className="text-pink-500 mx-auto mb-3" size={40} />
            <h4 className="font-bold text-slate-800 text-lg mb-2">{systemMessage.title}</h4>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{systemMessage.text}</p>
            <button onClick={() => setSystemMessage(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Kapat</button>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto p-5 space-y-6">
        {activeTab === 'request' && (
          <>
            <div className="bg-gradient-to-br from-pink-500 to-rose-400 p-6 rounded-[35px] text-white shadow-xl shadow-pink-100 flex items-center justify-between transition-all">
              <div><h2 className="text-xl font-bold tracking-tight">Acil Yardım 🌸</h2><p className="text-pink-50 text-[11px] mt-1 font-medium opacity-90 italic">Ücretsiz ve anonim destek.</p></div>
              <div className="text-right"><span className="text-[10px] font-black bg-pink-600/50 px-2 py-1 rounded-lg uppercase">Limit</span><p className="text-xl font-black leading-none mt-1 tracking-tighter">{monthlyCount}/2</p></div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konum Seç</p>
              <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="relative">
                  <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none text-sm appearance-none border-none focus:ring-2 focus:ring-pink-300 transition-all">
                    <option value="">Bir yer seç...</option>
                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                  <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none rotate-90" />
                </div>
                <button disabled={!selectedLocation || monthlyCount >= 2} onClick={() => setShowConfirmModal(true)} className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${!selectedLocation || monthlyCount >= 2 ? 'bg-slate-100 text-slate-300 grayscale opacity-50 shadow-none' : 'bg-pink-500 text-white shadow-lg active:scale-95 shadow-pink-100'}`}>
                  <Send size={18} /> Şimdi İste
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><History size={14} /> Geçmiş Taleplerim</h3>
              {requests.length > 0 ? (
                requests.slice(0, 8).map(req => (
                  <div key={req.id} className="bg-white p-4 rounded-[28px] border border-slate-50 shadow-sm animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${req.status === 'Completed' ? 'bg-green-50 text-green-500' : req.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : 'bg-pink-50 text-pink-500'}`}>
                           {req.status === 'Completed' ? <CheckCircle2 size={18}/> : req.status === 'Cancelled' ? <X size={18}/> : <Clock size={18}/>}
                         </div>
                         <div>
                          <p className="font-black text-sm text-slate-800 leading-tight">{req.location}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{new Date(req.created_at).toLocaleDateString('tr-TR', {month:'short', day:'numeric'})} • {new Date(req.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'Pending' && <button onClick={() => setShowCancelModal(req)} className="bg-red-50 text-red-400 p-2 rounded-xl active:scale-90 transition-transform shadow-sm"><Trash2 size={16} /></button>}
                        <span className={`text-[8px] font-black uppercase px-2 py-1.5 rounded-lg border tracking-tighter shadow-sm ${req.status === 'Pending' ? 'text-amber-600 bg-amber-50 border-amber-100' : req.status === 'Claimed' ? 'text-blue-600 bg-blue-50 border-blue-100' : req.status === 'Delivered' ? 'text-purple-600 bg-purple-50 border-purple-100' : req.status === 'Cancelled' ? 'text-slate-400 bg-slate-50 border-slate-200' : 'text-green-600 bg-green-50 border-green-100'}`}>
                          {req.status === 'Delivered' ? 'Kapıda 📍' : req.status === 'Claimed' ? 'Gönüllü Yolda' : req.status === 'Pending' ? 'Beklemede' : req.status === 'Cancelled' ? 'İptal Edildi' : 'Tamamlandı'}
                        </span>
                      </div>
                    </div>
                    {req.status === 'Delivered' && (
                      <button onClick={() => handleConfirmReceipt(req.id)} className="w-full bg-pink-500 text-white py-2.5 rounded-xl text-xs font-black mt-3 shadow-lg shadow-pink-100 active:scale-95 transition-all flex items-center justify-center gap-2"><Check size={14}/> Aldım ✅</button>
                    )}
                    {(req.status === 'Claimed' || req.status === 'Delivered') && (
                      <div className="mt-3 pt-3 border-t border-slate-50">
                        <button onClick={() => setViewingChat(viewingChat === req.id ? null : req.id)} className="w-full text-blue-600 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-blue-50 py-2.5 rounded-xl transition-all uppercase tracking-widest border border-blue-50">
                          <MessageSquare size={14}/> {viewingChat === req.id ? 'Sohbeti Kapat' : 'Gönüllü ile Yazış'}
                        </button>
                        {viewingChat === req.id && <ChatView requestId={req.id} role="requester" name="Siz" />}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-300 text-xs py-10 bg-white rounded-[32px] border border-dashed border-slate-100 italic font-medium">Henüz geçmiş bir talebin yok.</p>
              )}
            </div>
          </>
        )}

        {activeTab === 'login' && (
          <div className="bg-white p-10 rounded-[50px] border border-slate-100 shadow-2xl text-center space-y-6 mt-10 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-[24px] mx-auto flex items-center justify-center shadow-inner"><Users size={32} /></div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gönüllü Portalı</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              const formData = new FormData(e.currentTarget);
              const u = formData.get('u')?.trim();
              const p = formData.get('p')?.trim();
             
              const { data, error } = await supabase
                .from('volunteers')
                .select('*')
                .eq('username', u)
                .eq('password', p)
                .maybeSingle();
             
              if (error) {
                setLoginError(`Veritabanı Hatası: ${error.message}`);
              } else if (data) {
                localStorage.setItem('padpal_v_session', JSON.stringify(data));
                setUser(data);
                setActiveTab('volunteer');
                fetchData();
              } else {
                setLoginError('Kullanıcı adı veya şifre hatalı.');
              }
            }} className="space-y-4">
              {loginError && <div className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">{loginError}</div>}
              <input name="u" placeholder="Kullanıcı Adı" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm" required />
              <input name="p" type="password" placeholder="Şifre" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm" required />
              <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-slate-100">Giriş Yap</button>
            </form>
            <button onClick={() => setActiveTab('request')} className="text-slate-400 text-[10px] font-black underline hover:text-pink-500 uppercase tracking-widest">Öğrenci Görünümü</button>
          </div>
        )}

        {activeTab === 'volunteer' && user && (
          <section className="space-y-6 animate-in fade-in duration-500">
            {/* VOLUNTEER STATUS CARD */}
            <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-xl space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div>
                        <h2 className="font-black text-slate-800 tracking-tight">Nöbet Durumu</h2>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{user.full_name}</p>
                    </div>
                    <button
                        onClick={() => updateVolunteerStatus(user.current_location, !user.is_available)}
                        className={`p-2 rounded-2xl transition-all ${user.is_available ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-300'}`}
                    >
                        {user.is_available ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>

                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Güncel Konumunuz</p>
                    <select
                        value={user.current_location || ""}
                        onChange={(e) => updateVolunteerStatus(e.target.value, user.is_available)}
                        className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 outline-none text-sm border-none focus:ring-2 focus:ring-pink-300 transition-all"
                    >
                        <option value="">Kampüs Dışı / Hareketli</option>
                        {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Gelen Çağrılar</p>
              {requests.filter(r => r.status === 'Pending').map(req => (
                <div key={req.id} className="bg-white p-5 rounded-[28px] border-2 border-pink-50 flex justify-between items-center shadow-md animate-in zoom-in-95 transition-all">
                  <div><h3 className="font-black text-base text-slate-800">{req.location}</h3><p className="text-[9px] text-pink-500 font-black uppercase tracking-widest mt-0.5 animate-pulse">Çağrı Geldi</p></div>
                  <button onClick={() => {
                    const activeTasks = requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name);
                    if (activeTasks.length > 0 && (Date.now() - new Date(req.created_at).getTime()) < 300000) {
                      setSystemMessage({ title: "Bekle", text: "Önce elindeki görevi bitirmelisin (veya 5dk bekle)." }); return;
                    }
                    supabase.from('requests').update({ status: 'Claimed', volunteer_name: user.full_name }).eq('id', req.id).then(() => fetchData());
                  }} className="bg-pink-500 text-white px-6 py-2.5 rounded-2xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-pink-100 uppercase">Görevi Al</button>
                </div>
              ))}
              {requests.filter(r => r.status === 'Pending').length === 0 && <p className="text-center text-slate-300 text-xs py-10 bg-white/50 rounded-3xl border-2 border-dashed border-slate-100 italic">Şu an aktif çağrı yok.</p>}
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Aktif Görevlerim</p>
              {requests.filter(r => (r.status === 'Claimed' || r.status === 'Delivered') && r.volunteer_name === user.full_name).map(req => (
                <div key={req.id} className={`bg-white border border-blue-100 rounded-[40px] p-6 space-y-4 shadow-sm transition-all ${req.status === 'Delivered' ? 'opacity-80 grayscale-[30%]' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div><h3 className="font-black text-blue-600 text-base">{req.location}</h3><p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{req.status === 'Delivered' ? 'Öğrenci Onayı Bekleniyor' : 'Yoldasınız'}</p></div>
                    <div className="flex gap-2">
                        {req.status === 'Claimed' && <button onClick={() => supabase.from('requests').update({ status: 'Delivered' }).eq('id', req.id).then(() => fetchData())} className="bg-green-500 text-white px-5 py-2.5 rounded-2xl active:scale-90 transition-all font-black text-xs shadow-lg shadow-green-100 flex items-center gap-2"><MapPin size={14}/> Vardım</button>}
                        {user.is_admin && req.status === 'Delivered' && (
                            <button onClick={() => handleConfirmReceipt(req.id)} className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl active:scale-90 transition-all font-black text-[10px] shadow-lg flex items-center gap-2 border border-slate-700">
                                <ShieldCheck size={14} className="text-pink-400" /> Zorunlu Onay
                            </button>
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
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[35px] text-white shadow-2xl flex justify-between items-center ring-4 ring-slate-800/50">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2 tracking-tight"><BarChart3 className="text-pink-400"/> Analizler</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-black">Canlı Veriler</p>
              </div>
              <Activity className="text-pink-500 animate-pulse" size={24} />
            </div>

            {/* VOLUNTEER MAP */}
            <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Map size={14} className="text-pink-500"/> Ekip Durumu</h3>
                <div className="space-y-3">
                    {volunteers.filter(v => v.is_available).map(v => (
                        <div key={v.full_name} className="flex justify-between items-center p-3 bg-green-50 rounded-2xl border border-green-100 animate-in zoom-in-95">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-black text-xs">{v.full_name.charAt(0).toUpperCase()}</div>
                                <div>
                                    <p className="text-xs font-black text-slate-700">{v.full_name}</p>
                                    <p className="text-[9px] text-green-600 font-bold flex items-center gap-1"><MapPin size={10}/> {v.current_location || "Kampüste"}</p>
                                </div>
                            </div>
                            <span className="text-[8px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Müsait</span>
                        </div>
                    ))}
                    {volunteers.filter(v => v.is_available).length === 0 && <p className="text-center text-slate-300 text-[11px] py-4 italic font-medium">Şu an aktif gönüllü yok.</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[30px] shadow-sm border border-slate-100 text-center">
                <p className="text-2xl font-black text-slate-800">{getAnalytics().total}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase">Toplam Talep</p>
              </div>
              <div className="bg-white p-5 rounded-[30px] shadow-sm border border-slate-100 text-center">
                <p className="text-2xl font-black text-green-500">{getAnalytics().completed}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase">Başarılı</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[35px] shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={14}/> Popüler Konumlar</h3>
              <div className="space-y-4">
                {getAnalytics().hotspots.map(([loc, count]) => (
                  <div key={loc} className="space-y-1.5">
                    <div className="flex justify-between items-end px-1">
                        <span className="text-xs font-bold text-slate-700">{loc}</span>
                        <span className="text-[10px] font-black text-pink-500">{count} talep</span>
                    </div>
                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                        <div className="bg-pink-500 h-full rounded-full transition-all duration-1000" style={{ width: `${getAnalytics().total > 0 ? (count / getAnalytics().total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-6 left-10 right-10 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-4 flex justify-around items-center z-50 rounded-[2.5rem] backdrop-blur-md bg-white/90 ring-1 ring-black/5">
        <button onClick={() => setActiveTab('request')} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'request' ? 'text-pink-500 scale-110 font-black' : 'text-slate-300 font-bold'}`}>
          <Heart size={24} fill={activeTab === 'request' ? "currentColor" : "none"} />
          <span className="text-[9px] uppercase tracking-widest">Yardım</span>
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