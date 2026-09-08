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
  ['starNetTab', 'stretchTab', 'stretchScopeHint', 'stretchDetailsToggle', 'stretchDetailsPanel',
    'openStretchEditor', 'createStretchLayer', 'cancelStretch'].forEach(function (id) {
    assert(html.indexOf('id="' + id + '"') >= 0, id + '가 없습니다.');
  });
  ['preset', 'strength', 'saturation', 'skyOnly', 'createLayer', 'preview',
    'viewOriginal', 'viewStretched', 'viewSplit'].forEach(function (id) {
    assert(editor.indexOf('id="' + id + '"') >= 0, 'Editor ' + id + '가 없습니다.');
  });
  assert(main.indexOf("requestOpenExtension('com.drmedia.starnet.stretcheditor'") >= 0);
  assert(/settings\.skyOnly\?'layer-sky':'layer'/.test(main));
  assert(main.indexOf('command.sessionId!==stretchSessionId') >= 0);
  assert(main.indexOf('stretchTiffAsync') >= 0);
  assert(editorScript.indexOf('splitPosition') >= 0 && editorScript.indexOf('moveSplit') >= 0);
  assert(host.indexOf('processingTarget === "layer-sky"') >= 0);
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

    processor.stretchTiff(fs, input, unchanged, '15% Bg, 3 sigma', 1, 0);
    processor.stretchTiff(fs, input, stretched, '15% Bg, 3 sigma', 1, 50);

    [unchanged, stretched].forEach(function (file) {
      var fd = fs.openSync(file, 'r');
      try {
        var info = processor._tiffInfo(fs, fd);
        assert.strictEqual(info.width, width);
        assert.strictEqual(info.height, height);
      } finally { fs.closeSync(fd); }
    });
    assert(fs.readFileSync(unchanged).slice(header.pixelOffset).equals(pixels), 'Strength 0은 픽셀을 변경하면 안 됩니다.');
    assert(!fs.readFileSync(stretched).slice(header.pixelOffset).equals(pixels), 'Strength 50은 픽셀을 변경해야 합니다.');
    assert.strictEqual(processor.normalizeStrength(-1), 0);
    assert.strictEqual(processor.normalizeStrength(110), 100);
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
  processor.stretchTiffAsync(fs,input,output,'15% Bg, 3 sigma',1,50,{
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
    processor.stretchTiffAsync(fs,input,cancelledOutput,'15% Bg, 3 sigma',1,50,{
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
