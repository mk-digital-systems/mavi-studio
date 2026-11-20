/* Atomic project/draft persistence. Asset bytes are written once, never per edit. */
(function(root){
'use strict';
class ProjectStore {
  constructor(){
    this.ready=new Promise((resolve,reject)=>{try{const r=indexedDB.open('mavi-kadraj-film',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Proje deposu başka bir sekmede açık.'));}catch(e){reject(e);}});
    this.persisted=new Set();this.queue=Promise.resolve();
  }
  async request(mode,fn){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction('kv',mode);let q;try{q=fn(tx.objectStore('kv'));}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(q?.result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Kayıt tamamlanamadı.'));});}
  get(key){return this.request('readonly',s=>s.get(key));}
  refs(state){return [...new Set([...state.scenes.map(s=>s.assetId),...Object.values(state.audioAssets||{})].filter(Boolean))];}
  save(state,assets,{manual=false,view=null}={}){
    const frozen=structuredClone(state),record={format:3,state:frozen,savedAt:new Date().toISOString(),view},refs=this.refs(frozen);
    // Capture file references now. A project switch must not change an in-flight save.
    const pending=refs.map(id=>[id,assets.get(id)]);
    const run=async()=>{const writes=pending.filter(([id])=>!this.persisted.has(id));for(const [id,a]of writes)if(!a?.file)throw new Error('Kaydedilecek medya eksik: '+id);
      await this.request('readwrite',s=>{for(const [id,a]of writes)s.put({file:a.file,kind:a.kind},'asset:'+id);if(manual)s.put(record,'p:'+frozen.id);s.put(record,'draft:'+frozen.id);s.put({id:frozen.id},'session:last');});
      writes.forEach(([id])=>this.persisted.add(id));return record;
    };
    const task=this.queue.then(run,run);this.queue=task.catch(()=>{});return task;
  }
  async resolve(record){
    if(!record||record.format!==3)return record;
    const files=new Map();for(const id of this.refs(record.state)){const a=await this.get('asset:'+id);if(!a?.file)throw new Error('Projeye ait medya bulunamadı. Dosya yedeğini açın.');files.set(id,a.file);this.persisted.add(id);}
    return {...record,media:Object.fromEntries(record.state.scenes.filter(s=>s.assetId).map(s=>[s.id,files.get(s.assetId)])),audio:Object.fromEntries(Object.entries(record.state.audioAssets||{}).filter(([,id])=>id).map(([w,id])=>[w,files.get(id)]))};
  }
  async list(){
    // Do not load asset blobs to list project names.
    const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction('kv'),rows=new Map(),q=tx.objectStore('kv').openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;const key=String(c.key);if(key.startsWith('p:')||key.startsWith('draft:')){const r=c.value;if(r?.state?.scenes){const prev=rows.get(r.state.id);if(!prev||r.savedAt>prev.savedAt)rows.set(r.state.id,{id:r.state.id,name:r.state.name,count:r.state.scenes.length,savedAt:r.savedAt,key,draft:key.startsWith('draft:')});}}c.continue();};tx.oncomplete=()=>resolve([...rows.values()].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));tx.onerror=()=>reject(tx.error);});
  }
}
root.ProjectStore=ProjectStore;
})(typeof self==='undefined'?globalThis:self);
