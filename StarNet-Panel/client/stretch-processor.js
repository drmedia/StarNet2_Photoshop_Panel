(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StarNetStretchProcessor = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MAX_SAFE = 9007199254740991;
  var MAX_ROW_BYTES = 256 * 1024 * 1024;

  function preset(name) {
    if (name === '10% Bg, 3 sigma') return { background: 0.10, sigma: 3 };
    if (name === '15% Bg, 3 sigma') return { background: 0.15, sigma: 3 };
    if (name === '20% Bg, 3 sigma') return { background: 0.20, sigma: 3 };
    if (name === '30% Bg, 2 sigma') return { background: 0.30, sigma: 2 };
    throw new Error('지원하지 않는 Stretch preset입니다: ' + name);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizeStrength(value) {
    value = Number(value);
    return clamp(isFinite(value) ? value : 50, 0, 100);
  }

  function normalizeSaturation(value) {
    value = Number(value);
    return clamp(isFinite(value) ? value : 1, 0, 3);
  }

  function checkedProduct(values, label) {
    var result = 1;
    for (var index = 0; index < values.length; index++) {
      var value = Number(values[index]);
      if (!isFinite(value) || value < 0 || Math.floor(value) !== value ||
          (value && result > MAX_SAFE / value)) throw new Error(label + ' 크기가 올바르지 않습니다.');
      result *= value;
    }
    return result;
  }

  function readExact(fs, fd, buffer, position) {
    var offset = 0;
    while (offset < buffer.length) {
      var count = fs.readSync(fd, buffer, offset, buffer.length - offset, position + offset);
      if (!count) throw new Error('TIFF 데이터가 예상보다 짧습니다.');
      offset += count;
    }
  }

  function writeExact(fs, fd, buffer, position) {
    var offset = 0;
    while (offset < buffer.length) {
      offset += fs.writeSync(fd, buffer, offset, buffer.length - offset, position + offset);
    }
  }

  function fileRange(offset, length, fileSize, label) {
    if (offset < 0 || length < 0 || offset > fileSize || length > fileSize - offset) {
      throw new Error(label + '가 TIFF 파일 범위를 벗어납니다.');
    }
  }

  function tiffInfo(fs, fd) {
    var fileSize = fs.fstatSync(fd).size;
    if (fileSize < 8) throw new Error('TIFF 파일이 너무 짧습니다.');
    var header = Buffer.alloc(8);
    readExact(fs, fd, header, 0);
    if (header.toString('ascii', 0, 2) !== 'II' || header.readUInt16LE(2) !== 42) {
      throw new Error('little-endian TIFF만 지원합니다.');
    }
    var ifdOffset = header.readUInt32LE(4);
    fileRange(ifdOffset, 2, fileSize, 'TIFF IFD');
    var countBuffer = Buffer.alloc(2);
    readExact(fs, fd, countBuffer, ifdOffset);
    var entryCount = countBuffer.readUInt16LE(0);
    var entriesSize = checkedProduct([entryCount, 12], 'TIFF IFD');
    fileRange(ifdOffset + 2, entriesSize + 4, fileSize, 'TIFF IFD');
    var entries = Buffer.alloc(entriesSize);
    readExact(fs, fd, entries, ifdOffset + 2);
    var info = { width:0, height:0, bits:0, compression:0, photometric:0, samples:0,
      rowsPerStrip:0, planar:1, stripOffsets:[], stripByteCounts:[] };

    function values(type, count, at) {
      var itemSize = type === 3 ? 2 : type === 4 ? 4 : 0;
      if (!itemSize) return [];
      var size = checkedProduct([itemSize, count], 'TIFF tag');
      if (size > 64 * 1024 * 1024) throw new Error('TIFF tag가 너무 큽니다.');
      var source;
      if (size <= 4) source = entries.slice(at + 8, at + 12);
      else {
        var offset = entries.readUInt32LE(at + 8);
        fileRange(offset, size, fileSize, 'TIFF tag');
        source = Buffer.alloc(size);
        readExact(fs, fd, source, offset);
      }
      var result = [];
      for (var i = 0; i < count; i++) result.push(type === 3 ? source.readUInt16LE(i * 2) : source.readUInt32LE(i * 4));
      return result;
    }

    for (var entry = 0; entry < entryCount; entry++) {
      var at = entry * 12;
      var tag = entries.readUInt16LE(at);
      if ([256,257,258,259,262,273,277,278,279,284].indexOf(tag) < 0) continue;
      var tagValues = values(entries.readUInt16LE(at + 2), entries.readUInt32LE(at + 4), at);
      var value = tagValues[0] || 0;
      if (tag === 256) info.width = value;
      else if (tag === 257) info.height = value;
      else if (tag === 258) info.bits = tagValues.length && tagValues.every(function (bit) { return bit === 16; }) ? 16 : 0;
      else if (tag === 259) info.compression = value;
      else if (tag === 262) info.photometric = value;
      else if (tag === 273) info.stripOffsets = tagValues;
      else if (tag === 277) info.samples = value;
      else if (tag === 278) info.rowsPerStrip = value;
      else if (tag === 279) info.stripByteCounts = tagValues;
      else if (tag === 284) info.planar = value;
    }
    if (!info.rowsPerStrip) info.rowsPerStrip = info.height;
    if (!info.width || !info.height || info.bits !== 16 || info.compression !== 1 ||
        info.photometric !== 2 || info.samples !== 3 || info.planar !== 1 ||
        !info.stripOffsets.length || info.stripOffsets.length !== info.stripByteCounts.length) {
      throw new Error('비압축 16-bit RGB TIFF만 지원합니다.');
    }
    var rowBytes = checkedProduct([info.width, 6], 'TIFF row');
    if (rowBytes > MAX_ROW_BYTES) throw new Error('TIFF 한 행이 256MB 제한을 초과합니다.');
    for (var strip = 0; strip < info.stripOffsets.length; strip++) {
      fileRange(info.stripOffsets[strip], info.stripByteCounts[strip], fileSize, 'TIFF strip');
    }
    return info;
  }

  function rowPosition(info, row) {
    var strip = Math.floor(row / info.rowsPerStrip);
    var inStrip = row - strip * info.rowsPerStrip;
    var rowBytes = info.width * 6;
    if (strip >= info.stripOffsets.length || (inStrip + 1) * rowBytes > info.stripByteCounts[strip]) {
      throw new Error('TIFF strip 정보가 올바르지 않습니다.');
    }
    return info.stripOffsets[strip] + inStrip * rowBytes;
  }

  function outputHeader(width, height) {
    var count = 10, ifdOffset = 8, ifdSize = 2 + count * 12 + 4;
    var bitsOffset = ifdOffset + ifdSize, pixelOffset = bitsOffset + 6;
    if (pixelOffset % 2) pixelOffset++;
    var pixelBytes = checkedProduct([width, height, 6], 'TIFF pixels');
    if (pixelBytes > 0xffffffff - pixelOffset) throw new Error('Classic TIFF 4GB 제한을 초과합니다.');
    var buffer = Buffer.alloc(pixelOffset), at = ifdOffset;
    buffer.write('II', 0, 2, 'ascii'); buffer.writeUInt16LE(42, 2); buffer.writeUInt32LE(ifdOffset, 4);
    buffer.writeUInt16LE(count, at); at += 2;
    function entry(tag, type, itemCount, value) {
      buffer.writeUInt16LE(tag, at); buffer.writeUInt16LE(type, at + 2); buffer.writeUInt32LE(itemCount, at + 4);
      if (type === 3 && itemCount === 1) buffer.writeUInt16LE(value, at + 8);
      else buffer.writeUInt32LE(value, at + 8);
      at += 12;
    }
    entry(256,4,1,width); entry(257,4,1,height); entry(258,3,3,bitsOffset); entry(259,3,1,1);
    entry(262,3,1,2); entry(273,4,1,pixelOffset); entry(277,3,1,3); entry(278,4,1,height);
    entry(279,4,1,pixelBytes); entry(284,3,1,1); buffer.writeUInt32LE(0, at);
    buffer.writeUInt16LE(16,bitsOffset); buffer.writeUInt16LE(16,bitsOffset+2); buffer.writeUInt16LE(16,bitsOffset+4);
    return { buffer:buffer, pixelOffset:pixelOffset };
  }

  function median(histogram, total) {
    var target = (total + 1) / 2, sum = 0;
    for (var index = 0; index < histogram.length; index++) {
      sum += histogram[index] || 0;
      if (sum >= target) return index;
    }
    return histogram.length - 1;
  }

  function mtf(value, midtone) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    var denominator = (2 * midtone - 1) * value - midtone;
    return Math.abs(denominator) < 1e-12 ? value : (midtone - 1) * value / denominator;
  }

  function parameters(histogram, setting) {
    var valid = 0;
    for (var i = 1; i < histogram.length - 1; i++) valid += histogram[i] || 0;
    var maximum = histogram.length - 1;
    if (!valid) return { shadow:0, midtone:0.5 };
    var filtered = histogram.slice(); filtered[0] = 0; filtered[maximum] = 0;
    var medianBin = median(filtered, valid), deviation = [];
    for (i = 0; i < histogram.length; i++) deviation[i] = 0;
    for (i = 1; i < maximum; i++) deviation[Math.abs(i - medianBin)] += histogram[i] || 0;
    var background = medianBin / maximum;
    var mad = median(deviation, valid) / maximum;
    var shadow = clamp(background - setting.sigma * mad, 0, 1);
    var normalizedMedian = (background - shadow) / Math.max(1e-12, 1 - shadow);
    return { shadow:shadow, midtone:mtf(normalizedMedian, setting.background) };
  }

  function stretchValue(value, parameter, maximum) {
    var normalized = value / maximum;
    if (normalized <= parameter.shadow) return 0;
    return clamp(Math.round(mtf((normalized - parameter.shadow) / Math.max(1e-12, 1 - parameter.shadow), parameter.midtone) * maximum), 0, maximum);
  }

  function stretchTiff(fs, sourcePath, destinationPath, presetName, saturationValue, strengthValue) {
    var setting = preset(presetName), saturation = normalizeSaturation(saturationValue);
    var strength = normalizeStrength(strengthValue) / 100, input = null, output = null;
    try {
      input = fs.openSync(sourcePath, 'r');
      var info = tiffInfo(fs, input), rowBytes = info.width * 6, row = Buffer.alloc(rowBytes);
      var histograms = [[],[],[]];
      for (var channel=0; channel<3; channel++) for (var bin=0; bin<4096; bin++) histograms[channel][bin]=0;
      var stride = Math.max(1, Math.floor(Math.sqrt(info.width * info.height / 250000)));
      for (var y=0; y<info.height; y+=stride) {
        readExact(fs,input,row,rowPosition(info,y));
        for (var x=0; x<info.width; x+=stride) for (channel=0; channel<3; channel++) histograms[channel][row.readUInt16LE(x*6+channel*2)>>>4]++;
      }
      var params = [parameters(histograms[0],setting),parameters(histograms[1],setting),parameters(histograms[2],setting)];
      var header = outputHeader(info.width,info.height); output = fs.openSync(destinationPath,'w'); writeExact(fs,output,header.buffer,0);
      for (y=0; y<info.height; y++) {
        readExact(fs,input,row,rowPosition(info,y));
        for (x=0; x<info.width; x++) {
          var at=x*6, rgb=[];
          for (channel=0; channel<3; channel++) {
            var original=row.readUInt16LE(at+channel*2), stretched=stretchValue(original,params[channel],65535);
            rgb[channel]=Math.round(original+strength*(stretched-original));
          }
          var gray=.299*rgb[0]+.587*rgb[1]+.114*rgb[2];
          for (channel=0; channel<3; channel++) row.writeUInt16LE(clamp(Math.round(gray+saturation*(rgb[channel]-gray)),0,65535),at+channel*2);
        }
        writeExact(fs,output,row,header.pixelOffset+y*rowBytes);
      }
      fs.closeSync(output); output=null; fs.closeSync(input); input=null;
      return { width:info.width, height:info.height, preset:presetName, strength:strengthValue, saturation:saturationValue };
    } catch (error) {
      try { if (output !== null) fs.closeSync(output); } catch (_) {}
      try { if (input !== null) fs.closeSync(input); } catch (_) {}
      try { if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath); } catch (_) {}
      throw error;
    }
  }

  function stretchTiffAsync(fs, sourcePath, destinationPath, presetName, saturationValue, strengthValue, options, callback) {
    options = options || {};
    callback = typeof callback === 'function' ? callback : function () {};
    var setting, saturation, normalizedStrength, strength, input = null, output = null;
    var info, rowBytes, row, histograms, stride, params, header;
    var phase = 'histogram', y = 0, completed = false;

    function isCancelled() {
      try { return !!(options.isCancelled && options.isCancelled()); } catch (_) { return false; }
    }

    function report(percent) {
      try { if (options.onProgress) options.onProgress(clamp(percent, 0, 100)); } catch (_) {}
    }

    function closeFiles() {
      try { if (output !== null) fs.closeSync(output); } catch (_) {}
      try { if (input !== null) fs.closeSync(input); } catch (_) {}
      output = null;
      input = null;
    }

    function fail(error) {
      if (completed) return;
      completed = true;
      closeFiles();
      try { if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath); } catch (_) {}
      callback(error);
    }

    function finish() {
      if (completed) return;
      closeFiles();
      completed = true;
      report(100);
      callback(null, { width:info.width, height:info.height, preset:presetName,
        strength:normalizedStrength, saturation:saturation });
    }

    try {
      setting = preset(presetName);
      saturation = normalizeSaturation(saturationValue);
      normalizedStrength = normalizeStrength(strengthValue);
      strength = normalizedStrength / 100;
      input = fs.openSync(sourcePath, 'r');
      info = tiffInfo(fs, input);
      rowBytes = info.width * 6;
      row = Buffer.alloc(rowBytes);
      histograms = [[],[],[]];
      for (var channel=0; channel<3; channel++) {
        for (var bin=0; bin<4096; bin++) histograms[channel][bin]=0;
      }
      stride = Math.max(1, Math.floor(Math.sqrt(info.width * info.height / 250000)));
    } catch (error) {
      fail(error);
      return;
    }

    function step() {
      if (completed) return;
      if (isCancelled()) {
        var cancelled = new Error('Stretch 처리를 취소했습니다.');
        cancelled.cancelled = true;
        fail(cancelled);
        return;
      }
      var started = Date.now();
      try {
        if (phase === 'histogram') {
          while (y < info.height && Date.now() - started < 12) {
            readExact(fs,input,row,rowPosition(info,y));
            for (var x=0; x<info.width; x+=stride) {
              for (var channel=0; channel<3; channel++) {
                histograms[channel][row.readUInt16LE(x*6+channel*2)>>>4]++;
              }
            }
            y += stride;
          }
          report(Math.min(25, 25 * y / info.height));
          if (y >= info.height) {
            params = [parameters(histograms[0],setting),parameters(histograms[1],setting),parameters(histograms[2],setting)];
            header = outputHeader(info.width,info.height);
            output = fs.openSync(destinationPath,'w');
            writeExact(fs,output,header.buffer,0);
            phase = 'pixels';
            y = 0;
            report(25);
          }
        }
        if (phase === 'pixels') {
          while (y < info.height && Date.now() - started < 12) {
            readExact(fs,input,row,rowPosition(info,y));
            for (var x=0; x<info.width; x++) {
              var at=x*6, rgb=[];
              for (var channel=0; channel<3; channel++) {
                var original=row.readUInt16LE(at+channel*2);
                var stretched=stretchValue(original,params[channel],65535);
                rgb[channel]=Math.round(original+strength*(stretched-original));
              }
              var gray=.299*rgb[0]+.587*rgb[1]+.114*rgb[2];
              for (var channel=0; channel<3; channel++) {
                row.writeUInt16LE(clamp(Math.round(gray+saturation*(rgb[channel]-gray)),0,65535),at+channel*2);
              }
            }
            writeExact(fs,output,row,header.pixelOffset+y*rowBytes);
            y++;
          }
          report(25 + 75 * y / info.height);
          if (y >= info.height) { finish(); return; }
        }
      } catch (error) {
        fail(error);
        return;
      }
      setTimeout(step, 0);
    }

    setTimeout(step, 0);
  }

  function stretchRgba8(imageData, presetName, saturationValue, strengthValue) {
    var setting=preset(presetName), saturation=normalizeSaturation(saturationValue), strength=normalizeStrength(strengthValue)/100;
    var histograms=[[],[],[]], channel, bin;
    for(channel=0;channel<3;channel++) for(bin=0;bin<256;bin++) histograms[channel][bin]=0;
    var data=imageData.data;
    for(var at=0;at<data.length;at+=4) for(channel=0;channel<3;channel++) histograms[channel][data[at+channel]]++;
    var params=[parameters(histograms[0],setting),parameters(histograms[1],setting),parameters(histograms[2],setting)];
    var output=new Uint8ClampedArray(data.length);
    for(at=0;at<data.length;at+=4){
      var rgb=[];
      for(channel=0;channel<3;channel++){var original=data[at+channel], stretched=stretchValue(original,params[channel],255);rgb[channel]=original+strength*(stretched-original);}
      var gray=.299*rgb[0]+.587*rgb[1]+.114*rgb[2];
      for(channel=0;channel<3;channel++) output[at+channel]=clamp(Math.round(gray+saturation*(rgb[channel]-gray)),0,255);
      output[at+3]=data[at+3];
    }
    return output;
  }

  return { preset:preset, normalizeStrength:normalizeStrength, normalizeSaturation:normalizeSaturation,
    stretchTiff:stretchTiff, stretchTiffAsync:stretchTiffAsync, stretchRgba8:stretchRgba8,
    _tiffInfo:tiffInfo, _outputHeader:outputHeader };
}));
