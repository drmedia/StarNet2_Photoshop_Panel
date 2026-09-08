(function () {
  'use strict';
  var fs=null,os=null,path=null,stateText='',sourceCanvas=null,processedCanvas=null,state=null,loadedPreview='',viewMode='split',splitPosition=.5,splitDragging=false;
  var canvas=document.getElementById('preview'), empty=document.getElementById('empty');
  try { fs=require('fs'); os=require('os'); path=require('path'); } catch (_) {}
  function exchange(name){return fs&&os&&path?path.join(os.tmpdir(),'StarNet2-Photoshop',name):'';}
  function fileUrl(value){return ('file:///'+String(value||'').replace(/\\/g,'/')).replace(/#/g,'%23');}
  function command(action,value){
    var file=exchange('stretch_editor_command.json'); if(!file)return;
    try{fs.writeFileSync(file,JSON.stringify({id:Date.now()+'_'+Math.random(),sessionId:state&&state.sessionId,action:action,value:value}),'utf8');}catch(_){}
  }
  function renderProcessed(){
    if(!state||!sourceCanvas)return;
    var context=sourceCanvas.getContext('2d'), original=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height);
    var output=window.StarNetStretchProcessor.stretchRgba8(original,state.preset,state.saturation,state.strength);
    processedCanvas=document.createElement('canvas');processedCanvas.width=sourceCanvas.width;processedCanvas.height=sourceCanvas.height;
    var processedContext=processedCanvas.getContext('2d'), image=processedContext.createImageData(sourceCanvas.width,sourceCanvas.height);image.data.set(output);processedContext.putImageData(image,0,0);
    draw();
  }
  function previewLabel(context,text,x){
    context.font='12px Segoe UI, Arial, sans-serif';
    var width=context.measureText(text).width+14;
    context.fillStyle='rgba(0,0,0,.65)';context.fillRect(x,8,width,24);
    context.fillStyle='#fff';context.fillText(text,x+7,25);
  }
  function draw(){
    if(!state||!sourceCanvas||!processedCanvas)return;
    var width=Math.min(sourceCanvas.width,Math.max(1,canvas.parentNode.clientWidth-4));
    var height=Math.round(width*sourceCanvas.height/sourceCanvas.width), available=Math.max(1,canvas.parentNode.clientHeight-4);
    if(height>available){height=available;width=Math.round(height*sourceCanvas.width/sourceCanvas.height);}
    canvas.width=width;canvas.height=height;
    var display=canvas.getContext('2d');
    if(viewMode==='original'){
      display.drawImage(sourceCanvas,0,0,width,height);previewLabel(display,'원본',8);
    }else if(viewMode==='stretched'){
      display.drawImage(processedCanvas,0,0,width,height);previewLabel(display,'Stretch',8);
    }else{
      var splitX=Math.max(1,Math.min(width-1,Math.round(width*splitPosition)));
      display.drawImage(sourceCanvas,0,0,width,height);
      display.save();display.beginPath();display.rect(splitX,0,width-splitX,height);display.clip();display.drawImage(processedCanvas,0,0,width,height);display.restore();
      display.strokeStyle='rgba(255,255,255,.9)';display.lineWidth=1;display.beginPath();display.moveTo(splitX+.5,0);display.lineTo(splitX+.5,height);display.stroke();
      previewLabel(display,'원본',8);previewLabel(display,'Stretch',splitX+8);
    }
  }
  function loadPreview(file){
    var image=new Image();image.onload=function(){sourceCanvas=document.createElement('canvas');sourceCanvas.width=image.width;sourceCanvas.height=image.height;sourceCanvas.getContext('2d').drawImage(image,0,0);processedCanvas=null;empty.className='hidden';renderProcessed();};
    image.onerror=function(){empty.textContent='Preview 이미지를 불러올 수 없습니다.';};image.src=fileUrl(file)+'?v='+Date.now();
  }
  function apply(current){
    state=current;document.getElementById('sourceStatus').textContent=current.source||'활성 레이어';
    document.getElementById('preset').value=current.preset;document.getElementById('strength').value=current.strength;document.getElementById('strengthValue').textContent=current.strength+'%';
    document.getElementById('saturation').value=current.saturation;document.getElementById('saturationValue').textContent=Number(current.saturation).toFixed(1);document.getElementById('skyOnly').checked=!!current.skyOnly;
    if(!sourceCanvas||current.previewFile!==loadedPreview){loadedPreview=current.previewFile;loadPreview(current.previewFile);}else renderProcessed();
  }
  function poll(){var file=exchange('stretch_editor_state.json');if(!file||!fs.existsSync(file))return;try{var text=fs.readFileSync(file,'utf8');if(text&&text!==stateText){stateText=text;apply(JSON.parse(text));}}catch(_){}}
  function changed(){if(!state)return;state.preset=document.getElementById('preset').value;state.strength=Number(document.getElementById('strength').value);state.saturation=Number(document.getElementById('saturation').value);state.skyOnly=document.getElementById('skyOnly').checked;document.getElementById('strengthValue').textContent=state.strength+'%';document.getElementById('saturationValue').textContent=state.saturation.toFixed(1);renderProcessed();command('settings',{preset:state.preset,strength:state.strength,saturation:state.saturation,skyOnly:state.skyOnly});}
  document.getElementById('preset').onchange=changed;document.getElementById('strength').oninput=changed;document.getElementById('saturation').oninput=changed;document.getElementById('skyOnly').onchange=changed;
  var viewButtons=document.querySelectorAll('[data-view]');
  for(var viewIndex=0;viewIndex<viewButtons.length;viewIndex++)viewButtons[viewIndex].onclick=function(){viewMode=this.getAttribute('data-view');for(var index=0;index<viewButtons.length;index++)viewButtons[index].classList.toggle('active',viewButtons[index]===this);canvas.classList.toggle('split-view',viewMode==='split');draw();};
  function moveSplit(event){
    if(viewMode!=='split')return;
    var bounds=canvas.getBoundingClientRect();
    if(!bounds.width)return;
    splitPosition=Math.max(.02,Math.min(.98,(event.clientX-bounds.left)/bounds.width));
    draw();
  }
  canvas.onmousedown=function(event){if(viewMode!=='split')return;splitDragging=true;moveSplit(event);event.preventDefault();};
  window.addEventListener('mousemove',function(event){if(splitDragging)moveSplit(event);});
  window.addEventListener('mouseup',function(){splitDragging=false;});
  document.getElementById('createLayer').onclick=function(){
    if(!state)return;
    changed();
    command('create',{preset:state.preset,strength:state.strength,saturation:state.saturation,skyOnly:state.skyOnly,documentId:state.documentId,layerId:state.layerId});
  };
  document.getElementById('closeEditor').onclick=function(){try{if(window.__adobe_cep__&&window.__adobe_cep__.closeExtension){window.__adobe_cep__.closeExtension();return;}}catch(_){}window.close();};
  window.onresize=draw;poll();window.setInterval(poll,250);
}());
