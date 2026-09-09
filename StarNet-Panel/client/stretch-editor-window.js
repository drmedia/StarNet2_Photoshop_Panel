(function () {
  'use strict';
  function setEditorWindowTitle(){
    var title='StarNet2 Stretch Editor';
    document.title=title;
    try{
      if(window.__adobe_cep__&&typeof window.__adobe_cep__.invokeSync==='function')window.__adobe_cep__.invokeSync('setWindowTitle',title);
      else if(window.__adobe_cep__&&typeof window.__adobe_cep__.setWindowTitle==='function')window.__adobe_cep__.setWindowTitle(title);
    }catch(_){}
  }
  setEditorWindowTitle();
  window.setTimeout(setEditorWindowTitle,250);
  var fs=null,os=null,path=null,stateText='',sourceCanvas=null,processedCanvas=null,state=null,loadedPreview='',viewMode='split',splitPosition=.5,splitDragging=false,closeTimer=null,zoomScale=null,lastDisplayScale=1;
  var canvas=document.getElementById('preview'), empty=document.getElementById('empty');
  try { fs=require('fs'); os=require('os'); path=require('path'); } catch (_) {}
  function exchange(name){return fs&&os&&path?path.join(os.tmpdir(),'StarNet2-Photoshop',name):'';}
  function fileUrl(value){return ('file:///'+String(value||'').replace(/\\/g,'/')).replace(/#/g,'%23');}
  function command(action,value){
    var file=exchange('stretch_editor_command.json'); if(!file)return;
    try{fs.writeFileSync(file,JSON.stringify({id:Date.now()+'_'+Math.random(),sessionId:state&&state.sessionId,action:action,value:value}),'utf8');}catch(_){}
  }
  function closeEditor(){try{if(window.__adobe_cep__&&window.__adobe_cep__.closeExtension){window.__adobe_cep__.closeExtension();return;}}catch(_){}window.close();}
  function setProcessing(processing){
    var controls=document.querySelectorAll('.toolbar select, .toolbar input, #createLayer');
    for(var index=0;index<controls.length;index++)controls[index].disabled=processing;
    document.getElementById('createLayer').textContent=processing?'처리 중…':'Stretched 레이어 생성';
  }
  function renderProcessed(){
    if(!state||!sourceCanvas)return;
    var context=sourceCanvas.getContext('2d'), original=context.getImageData(0,0,sourceCanvas.width,sourceCanvas.height);
    var output=window.StarNetStretchProcessor.stretchRgba8(original,state.background,state.sigma,state.saturation);
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
    var availableWidth=Math.max(1,canvas.parentNode.clientWidth-4),availableHeight=Math.max(1,canvas.parentNode.clientHeight-4);
    var fitScale=Math.min(1,availableWidth/sourceCanvas.width,availableHeight/sourceCanvas.height);
    lastDisplayScale=zoomScale===null?fitScale:Math.max(.1,Math.min(4,zoomScale));
    var width=Math.max(1,Math.round(sourceCanvas.width*lastDisplayScale));
    var height=Math.max(1,Math.round(sourceCanvas.height*lastDisplayScale));
    canvas.width=width;canvas.height=height;
    document.getElementById('zoomValue').textContent=zoomScale===null?'맞춤':Math.round(lastDisplayScale*100)+'%';
    document.getElementById('zoomFit').classList.toggle('active',zoomScale===null);
    document.getElementById('zoomActual').classList.toggle('active',zoomScale===1);
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
    if(state.background===undefined||state.sigma===undefined){try{var setting=window.StarNetStretchProcessor.preset(state.preset);state.background=setting.background;state.sigma=setting.sigma;}catch(_){state.background=15;state.sigma=3;}}
    state.background=window.StarNetStretchProcessor.normalizeBackground(state.background);state.sigma=window.StarNetStretchProcessor.normalizeSigma(state.sigma);state.saturation=window.StarNetStretchProcessor.normalizeSaturation(state.saturation);
    document.getElementById('preset').value=state.preset||'사용자 설정';document.getElementById('background').value=state.background;document.getElementById('backgroundValue').textContent=Math.round(state.background)+'%';
    document.getElementById('sigma').value=state.sigma;document.getElementById('sigmaValue').textContent=Number(state.sigma).toFixed(1)+' sigma';
    document.getElementById('saturation').value=state.saturation;document.getElementById('saturationValue').textContent=Number(state.saturation).toFixed(1);
    document.getElementById('maskStatus').textContent=state.maskMode==='selection'?'선택 영역 사용':(state.maskMode==='layer-mask'?'현재 레이어 마스크 복사':'적용 안 함');
    if(state.runStatus==='processing'){
      setProcessing(true);document.getElementById('sourceStatus').textContent=state.runMessage||'Stretch 처리 중…';
    }else if(state.runStatus==='completed'){
      setProcessing(true);document.getElementById('createLayer').textContent='완료';document.getElementById('sourceStatus').textContent=state.runMessage||'Stretched 레이어를 생성했습니다.';
      if(!closeTimer)closeTimer=window.setTimeout(closeEditor,1000);
    }else if(state.runStatus==='error'||state.runStatus==='cancelled'){
      setProcessing(false);document.getElementById('sourceStatus').textContent=state.runMessage||(state.runStatus==='cancelled'?'처리를 취소했습니다.':'처리에 실패했습니다.');
    }else setProcessing(false);
    if(!sourceCanvas||current.previewFile!==loadedPreview){loadedPreview=current.previewFile;loadPreview(current.previewFile);}else renderProcessed();
  }
  function poll(){var file=exchange('stretch_editor_state.json');if(!file||!fs.existsSync(file))return;try{var text=fs.readFileSync(file,'utf8');if(text&&text!==stateText){stateText=text;apply(JSON.parse(text));}}catch(_){}}
  function changed(custom){if(!state)return;if(custom){state.preset='사용자 설정';document.getElementById('preset').value=state.preset;}state.background=window.StarNetStretchProcessor.normalizeBackground(document.getElementById('background').value);state.sigma=window.StarNetStretchProcessor.normalizeSigma(document.getElementById('sigma').value);state.saturation=window.StarNetStretchProcessor.normalizeSaturation(document.getElementById('saturation').value);document.getElementById('backgroundValue').textContent=Math.round(state.background)+'%';document.getElementById('sigmaValue').textContent=Number(state.sigma).toFixed(1)+' sigma';document.getElementById('saturationValue').textContent=state.saturation.toFixed(1);renderProcessed();command('settings',{preset:state.preset,background:state.background,sigma:state.sigma,saturation:state.saturation});}
  document.getElementById('preset').onchange=function(){if(!state)return;state.preset=this.value;if(this.value!=='사용자 설정'){var setting=window.StarNetStretchProcessor.preset(this.value);document.getElementById('background').value=setting.background;document.getElementById('sigma').value=setting.sigma;}changed(false);};
  document.getElementById('background').oninput=function(){changed(true);};document.getElementById('sigma').oninput=function(){changed(true);};document.getElementById('saturation').oninput=function(){changed(false);};
  var viewButtons=document.querySelectorAll('[data-view]');
  for(var viewIndex=0;viewIndex<viewButtons.length;viewIndex++)viewButtons[viewIndex].onclick=function(){viewMode=this.getAttribute('data-view');for(var index=0;index<viewButtons.length;index++)viewButtons[index].classList.toggle('active',viewButtons[index]===this);canvas.classList.toggle('split-view',viewMode==='split');draw();};
  document.getElementById('zoomFit').onclick=function(){zoomScale=null;draw();};
  document.getElementById('zoomActual').onclick=function(){zoomScale=1;draw();};
  document.getElementById('zoomOut').onclick=function(){zoomScale=Math.max(.1,lastDisplayScale/1.25);draw();};
  document.getElementById('zoomIn').onclick=function(){zoomScale=Math.min(4,lastDisplayScale*1.25);draw();};
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
    changed(false);
    setProcessing(true);document.getElementById('sourceStatus').textContent='Stretch 처리 요청 중…';
    command('create',{preset:state.preset,background:state.background,sigma:state.sigma,saturation:state.saturation,documentId:state.documentId,layerId:state.layerId});
  };
  document.getElementById('closeEditor').onclick=closeEditor;
  window.onresize=draw;poll();window.setInterval(poll,250);
}());
