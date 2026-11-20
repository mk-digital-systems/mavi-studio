/* Settings-only undo history. Media lives separately, referenced by immutable IDs. */
(function(root){
'use strict';
class ProjectHistory {
  constructor(initial,limit=120){this.limit=limit;this.reset(initial);}
  reset(value){this.entries=[structuredClone(value)];this.index=0;this.group=null;}
  endGroup(){this.group=null;}
  commit(value,group=null){
    const copy=structuredClone(value);
    if(JSON.stringify(copy)===JSON.stringify(this.entries[this.index]))return false;
    this.entries.splice(this.index+1);
    if(group&&group===this.group&&this.index>0)this.entries[this.index]=copy;
    else{this.entries.push(copy);this.index++;if(this.entries.length>this.limit+1){this.entries.shift();this.index--;}}
    this.group=group;return true;
  }
  get canUndo(){return this.index>0;}
  get canRedo(){return this.index<this.entries.length-1;}
  undo(){this.endGroup();return this.canUndo?structuredClone(this.entries[--this.index]):null;}
  redo(){this.endGroup();return this.canRedo?structuredClone(this.entries[++this.index]):null;}
}
if(typeof module!=='undefined')module.exports=ProjectHistory;else root.ProjectHistory=ProjectHistory;
})(typeof self==='undefined'?globalThis:self);
