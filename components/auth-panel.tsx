'use client';
import { useState } from 'react';
import { ArrowLeft, BarChart3, CheckCircle2, Lock, Mail, ShieldCheck, WalletCards } from 'lucide-react';

export function AuthPanel(){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setLoading(true);try{
 const res=await fetch(`/api/auth/${mode}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,name})});
 const data=await res.json();if(!res.ok)throw new Error(data.error||'خطا در ورود');location.assign('/dashboard/overview');
 }catch(e){setError(e instanceof Error?e.message:'خطا در درخواست')}finally{setLoading(false)}}
 return <main className="auth-page">
  <section className="auth-story">
   <div className="brand brand-light"><span className="brand-mark"><WalletCards size={24}/></span><span>حسابینو <small>مالی، شفاف، هوشمند</small></span></div>
   <div className="auth-story-inner"><div className="eyebrow light">راهکار یکپارچه مدیریت مالی</div><h1>کنترل دقیق‌تر،<br/>تصمیم‌های بهتر.</h1><p>از ثبت سند تا گزارش‌های مدیریتی؛ همه اطلاعات مالی کسب‌وکار در یک پنل امن و یکپارچه.</p>
    <div className="story-features"><span><ShieldCheck size={18}/> کنترل نقش‌های کاربری</span><span><BarChart3 size={18}/> گزارش‌های مالی</span><span><CheckCircle2 size={18}/> حسابداری دوبل</span></div>
   </div><div className="story-bottom">پایگاه داده مستقل PostgreSQL · قابلیت میزبانی اختصاصی</div>
  </section>
  <section className="auth-content"><div className="auth-form-wrap"><div className="mobile-brand brand"><span className="brand-mark"><WalletCards size={22}/></span>حسابینو</div>
   <div className="eyebrow">به حسابینو خوش آمدید</div><h2>{mode==='login'?'ورود به حساب کاربری':'ساخت حساب کاربری'}</h2><p className="auth-description">{mode==='login'?'اطلاعات ورود خود را وارد کنید.':'برای شروع یک شرکت آزمایشی شخصی ایجاد می‌شود.'}</p>
   <div className="mode-switch"><button type="button" onClick={()=>setMode('login')} className={mode==='login'?'selected':''}>ورود</button><button type="button" onClick={()=>setMode('register')} className={mode==='register'?'selected':''}>ثبت‌نام</button></div>
   <form onSubmit={submit} className="form-stack">
    {mode==='register'&&<label>نام و نام خانوادگی<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="نام کامل" minLength={2}/></label>}
    <label>ایمیل<div className="input-icon"><Mail size={18}/><input required type="email" dir="ltr" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>
    <label>رمز عبور<div className="input-icon"><Lock size={18}/><input required type="password" dir="ltr" minLength={mode==='register'?10:1} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••"/></div></label>
    {mode==='register'&&<p className="form-note">رمز عبور حداقل ۱۰ نویسه باشد.</p>}
    {error&&<div role="alert" className="alert error">{error}</div>}
    <button className="primary-btn full" disabled={loading} type="submit">{loading?'در حال بررسی...':mode==='login'?'ورود به داشبورد':'ایجاد حساب'} <ArrowLeft size={17}/></button>
   </form><div className="auth-foot">اطلاعات مالی واقعی را پیش از استفاده عملیاتی با حسابدار بررسی کنید.</div>
  </div></section>
 </main>
}
