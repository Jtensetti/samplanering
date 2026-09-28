import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {Provider,useApp} from './store';
import {Button,IconButton} from './ui';
import {X} from 'lucide-react';
function Notices(){const {notice,setNotice,act}=useApp();return notice?<div className={`toast ${notice.error?'error':''}`} role={notice.error?'alert':'status'}><span>{notice.text}</span>{notice.undo&&<Button onClick={()=>act(notice.undo)}>Ångra</Button>}<IconButton icon={X} label="Stäng meddelande" onClick={()=>setNotice(null)}/></div>:null}
import './style.css';
class ErrorBoundary extends React.Component{state={error:false};static getDerivedStateFromError(){return {error:true}}render(){if(this.state.error)return <div className="empty"><h1>Vyn kunde inte visas</h1><p>Dina sparade uppgifter finns kvar.</p><button onClick={()=>location.reload()}>Ladda om</button></div>;return this.props.children}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><Provider><App/><Notices/></Provider></ErrorBoundary>);
