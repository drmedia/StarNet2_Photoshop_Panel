'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');

var root = path.resolve(__dirname, '..');
var panel = path.join(root, 'StarNet-Panel');
var client = path.join(panel, 'client');
var read = function (file) { return fs.readFileSync(file, 'utf8'); };

function checkStructure() {
  var manifest = read(path.join(panel, 'CSXS', 'manifest.xml'));
  var html = read(path.join(client, 'index.html'));
  var editor = read(path.join(client, 'stretch-editor-window.html'));
  var editorScript = read(path.join(client, 'stretch-editor-window.js'));
  var main = read(path.join(client, 'main.js'));
  var host = read(path.join(panel, 'host', 'host.jsx'));
  var installer = read(path.join(root, 'Install_Windows.bat'));

  assert(manifest.indexOf('Id="com.drmedia.starnet.stretcheditor"') >= 0);
  assert(/<Type>Modeless<\/Type>/.test(manifest));
  assert.strictEqual((manifest.match(/<Menu>/g) || []).length, 1, '메뉴에는 주 패널만 노출해야 합니다.');
  assert.strictEqual((html.match(/<div\b/g) || []).length, (html.match(/<\/div>/g) || []).length, 'index.html div 개수가 맞지 않습니다.');
  ['starNetTab', 'stretchTab', 'starTargetValue', 'starTargetBadge', 'targetStatus',
    'starMaskValue', 'starMaskBadge', 'starMaskHint', 'stretchTargetValue', 'stretchTargetBadge', 'stretchTargetHint',
    'stretchMaskValue', 'stretchMaskBadge', 'stretchMaskHint', 'stretchPresetBadge', 'stretchBackgroundValue',
    'stretchBlackPointValue', 'stretchSaturationValue', 'stretchDetailsToggle', 'stretchDetailsPanel',
    'largeStarControl', 'largeStarStrength', 'resetDetails', 'openStretchEditor', 'createStretchLayer', 'cancelStretch'].forEach(function (id) {
    assert(html.indexOf('id="' + id + '"') >= 0, id + '가 없습니다.');
  });
  ['preset', 'background', 'sigma', 'saturation', 'maskStatus', 'createLayer', 'preview',
    'viewOriginal', 'viewStretched', 'viewSplit', 'zoomFit', 'zoomActual', 'zoomOut', 'zoomValue', 'zoomIn'].forEach(function (id) {
    assert(editor.indexOf('id="' + id + '"') >= 0, 'Editor ' + id + '가 없습니다.');
  });
  assert(main.indexOf("requestOpenExtension('com.drmedia.starnet.stretcheditor'") >= 0);
  assert(main.indexOf("'layer-auto'") >= 0);
  assert(html.indexOf('name="processingTarget"') < 0);
  assert(main.indexOf('input[name="processingTarget"]') < 0);
  assert(main.indexOf('stretchSettings.skyOnly') < 0);
  assert(main.indexOf('function setStretchDetailsOpen(open)') >= 0);
  assert(main.indexOf('function updateStretchDetailsUI()') >= 0);
  assert(html.indexOf('>미리보기 및 설정</button>') >= 0);
  assert(main.indexOf('function updateDetailsUI()') >= 0);
  assert(main.indexOf('function resetDetails()') >= 0);
  assert(main.indexOf("elements.largeStarControl.classList.toggle('disabled-control', !elements.importBoost.checked)") >= 0);
  assert(main.indexOf('command.sessionId!==stretchSessionId') >= 0);
  assert(main.indexOf('stretchTiffAsync') >= 0);
  assert(editorScript.indexOf('splitPosition') >= 0 && editorScript.indexOf('moveSplit') >= 0);
  assert(editorScript.indexOf('lastDisplayScale') >= 0 && editorScript.indexOf("zoomScale=null") >= 0);
  assert(editorScript.indexOf("state.runStatus==='completed'") >= 0);
  assert(editorScript.indexOf('window.setTimeout(closeEditor,1000)') >= 0);
  assert(editorScript.indexOf("invokeSync('setWindowTitle',title)") >= 0);
  assert(main.indexOf("type === 'ok' ? 'completed'") >= 0);
  assert(host.indexOf('processingTarget === "layer-sky"') >= 0);
  assert(host.indexOf('processingTarget === "layer-auto"') >= 0);
  assert(host.indexOf('ST_removeActiveLayerMaskWithoutApplying') >= 0);
  assert(host.indexOf('options.imageCompression = TIFFEncoding.NONE') >= 0);
  ['stretch-processor.js', 'stretch-editor-window.html', 'stretch-editor-window.css', 'stretch-editor-window.js'].forEach(function (name) {
    assert(installer.indexOf('client\\' + name) >= 0, '설치 검증 목록에 ' + name + '가 없습니다.');
  });
}

function checkStretchProcessor() {
  var processor = require(path.join(client, 'stretch-processor.js'));
  var temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'starnet2-stretch-test-'));
  var input = path.join(temporary, 'input.tif');
  var unchanged = path.join(temporary, 'unchanged.tif');
  var stretched = path.join(temporary, 'stretched.tif');
  try {
    var width = 4;
    var height = 2;
    var header = processor._outputHeader(width, height);
    var pixels = Buffer.alloc(width * height * 6);
    var values = [
      1000, 1200, 900, 4000, 4300, 3800, 9000, 8500, 8000, 18000, 17000, 16000,
      2500, 2200, 2000, 6000, 5800, 5500, 12000, 11500, 11000, 30000, 28000, 26000
    ];
    values.forEach(function (value, index) { pixels.writeUInt16LE(value, index * 2); });
    fs.writeFileSync(input, Buffer.concat([header.buffer, pixels]));

    processor.stretchTiff(fs, input, unchanged, 5, 3, 1);
    processor.stretchTiff(fs, input, stretched, 30, 2, 1);

    [unchanged, stretched].forEach(function (file) {
      var fd = fs.openSync(file, 'r');
      try {
        var info = processor._tiffInfo(fs, fd);
        assert.strictEqual(info.width, width);
        assert.strictEqual(info.height, height);
      } finally { fs.closeSync(fd); }
    });
    var darkPixels=fs.readFileSync(unchanged).slice(header.pixelOffset);
    var brightPixels=fs.readFileSync(stretched).slice(header.pixelOffset);
    assert(!brightPixels.equals(darkPixels), 'Background와 sigma 변경은 픽셀을 변경해야 합니다.');
    var darkTotal=0,brightTotal=0;
    for(var sample=0;sample<darkPixels.length;sample+=2){darkTotal+=darkPixels.readUInt16LE(sample);brightTotal+=brightPixels.readUInt16LE(sample);}
    assert(brightTotal>darkTotal,'높은 Background 설정이 더 밝은 결과를 만들어야 합니다.');
    assert.strictEqual(processor.normalizeBackground(-1), 5);
    assert.strictEqual(processor.normalizeBackground(80), 40);
    assert.strictEqual(processor.normalizeSigma(0), 1);
    assert.strictEqual(processor.normalizeSigma(8), 5);
    assert.strictEqual(processor.normalizeSaturation(4), 3);
    assert.strictEqual(typeof processor.stretchTiffAsync, 'function');
    assert.throws(function () { processor.preset('unknown'); });
  } finally {
    fs.rmSync(temporary, { recursive:true, force:true });
  }
}

function checkAsyncStretchProcessor() {
  var processor = require(path.join(client, 'stretch-processor.js'));
  var temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'starnet2-stretch-async-test-'));
  var input = path.join(temporary, 'input.tif');
  var output = path.join(temporary, 'output.tif');
  var cancelledOutput = path.join(temporary, 'cancelled.tif');
  var header = processor._outputHeader(4, 2);
  var pixels = Buffer.alloc(4 * 2 * 6);
  for (var index=0; index<pixels.length/2; index++) pixels.writeUInt16LE(1000+index*900,index*2);
  fs.writeFileSync(input,Buffer.concat([header.buffer,pixels]));
  var progress = 0;
  processor.stretchTiffAsync(fs,input,output,15,3,1,{
    onProgress:function(value){progress=Math.max(progress,value);}
  },function(error){
    try {
      assert.ifError(error);
      assert(fs.existsSync(output),'비동기 Stretch 결과가 없습니다.');
      assert.strictEqual(progress,100,'비동기 Stretch 진행률이 완료되지 않았습니다.');
    } catch (assertionError) {
      fs.rmSync(temporary,{recursive:true,force:true});
      throw assertionError;
    }
    processor.stretchTiffAsync(fs,input,cancelledOutput,15,3,1,{
      isCancelled:function(){return true;}
    },function(cancelError){
      try {
        assert(cancelError&&cancelError.cancelled,'비동기 Stretch 취소 오류가 없습니다.');
        assert(!fs.existsSync(cancelledOutput),'취소된 Stretch 결과가 남았습니다.');
        console.log('StarNet2 panel tests passed');
      } finally {
        fs.rmSync(temporary,{recursive:true,force:true});
      }
    });
  });
}

checkStructure();
checkStretchProcessor();
checkAsyncStretchProcessor();
