(function () {
  'use strict';

  var csInterface = null;
  var node = null;
  var childProcess = null;
  var fs = null;
  var path = null;
  var os = null;
  var running = false;
  var documentAvailable = false;
  var detectingDocument = false;
  var activeLayerInfo = { supported: false, coverage: 'UNSUPPORTED', hasSelection: false, hasMask: false, documentId:0, layerId:0 };
  var executableAvailable = false;
  var executableValidationToken = 0;
  var executableValidationTimer = null;
  var activeProcess = null;
  var currentFiles = null;
  var cancelRequested = false;
  var progressTimer = null;
  var runStartedAt = 0;
  var lastMachinePercent = 0;
  var activeRunDocumentId = '';
  var activeRunSkyMaskToken = '';
  var activeRunLayerIds = [];
  var maxProcessLogLength = 65536;
  var activeFeature = 'starnet';
  var stretchRunning = false;
  var stretchPreviewFile = '';
  var stretchPreviewInfo = null;
  var stretchSettings = { preset:'15% Bg, 3 sigma', strength:50, saturation:1, skyOnly:false };
  var lastStretchCommandId = '';
  var stretchSessionId = Date.now() + '_' + Math.random();
  var stretchCancelRequested = false;
  var elements = {
    targetStatus: document.getElementById('targetStatus'),
    helpButton: document.getElementById('helpButton'),
    helpCard: document.getElementById('helpCard'),
    closeHelp: document.getElementById('closeHelp'),
    settingsButton: document.getElementById('settingsButton'),
    settingsCard: document.getElementById('settingsCard'),
    closeSettings: document.getElementById('closeSettings'),
    mainContent: document.getElementById('mainContent'),
    detailsToggle: document.getElementById('detailsToggle'),
    detailsPanel: document.getElementById('detailsPanel'),
    detailsToggleText: document.getElementById('detailsToggleText'),
    detailsChevron: document.getElementById('detailsChevron'),
    largeStarStrength: document.getElementById('largeStarStrength'),
    largeStarStrengthValue: document.getElementById('largeStarStrengthValue'),
    exePath: document.getElementById('exePath'),
    exeStatus: document.getElementById('exeStatus'),
    browsePath: document.getElementById('browsePath'),
    exeFilePicker: document.getElementById('exeFilePicker'),
    runButton: document.getElementById('runBtn'),
    cancelButton: document.getElementById('cancelBtn'),
    runText: document.getElementById('runText'),
    progressWrap: document.getElementById('progressWrap'),
    progressBar: document.getElementById('progressBar'),
    status: document.getElementById('status'),
    message: document.getElementById('message')
  };
  elements.starNetTab = document.getElementById('starNetTab');
  elements.stretchTab = document.getElementById('stretchTab');
  elements.starNetPanel = document.getElementById('starNetPanel');
  elements.stretchPanel = document.getElementById('stretchPanel');
  elements.stretchSummary = document.getElementById('stretchSummary');
  elements.stretchScopeHint = document.getElementById('stretchScopeHint');
  elements.stretchDetailsToggle = document.getElementById('stretchDetailsToggle');
  elements.stretchDetailsPanel = document.getElementById('stretchDetailsPanel');
  elements.stretchDetailsToggleText = document.getElementById('stretchDetailsToggleText');
  elements.stretchDetailsChevron = document.getElementById('stretchDetailsChevron');
  elements.openStretchEditor = document.getElementById('openStretchEditor');
  elements.createStretchLayer = document.getElementById('createStretchLayer');
  elements.stretchProgress = document.getElementById('stretchProgress');
  elements.stretchProgressBar = document.getElementById('stretchProgressBar');
  elements.stretchStatus = document.getElementById('stretchStatus');
  elements.stretchMessage = document.getElementById('stretchMessage');
  elements.cancelStretch = document.getElementById('cancelStretch');

  try {
    if (window.__adobe_cep__ && typeof CSInterface !== 'undefined') csInterface = new CSInterface();
    if (typeof require === 'function') {
      node = require;
    } else if (window.cep_node && window.cep_node.require) {
      node = window.cep_node.require;
    } else if (window.module && typeof window.module.require === 'function') {
      node = window.module.require.bind(window.module);
    }
    if (node) {
      childProcess = node('child_process');
      fs = node('fs');
      path = node('path');
      os = node('os');
    }
  } catch (error) { node = null; }

  function setProgress(message, percent) {
    elements.progressWrap.classList.remove('hidden');
    elements.status.textContent = message;
    elements.progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }

  function formatElapsed() {
    var seconds = Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000));
    var minutes = Math.floor(seconds / 60);
    return minutes + ':' + ('0' + (seconds % 60)).slice(-2);
  }

  function renderMachineProgress(percent) {
    lastMachinePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    setProgress('StarNet2 처리 중… ' + Math.round(lastMachinePercent) + '% · ' + formatElapsed(), 15 + (lastMachinePercent * 0.7));
  }

  function stopProgressTimer() {
    if (progressTimer) window.clearInterval(progressTimer);
    progressTimer = null;
  }

  function startProgressTimer() {
    stopProgressTimer();
    progressTimer = window.setInterval(function () {
      if (running && activeProcess && !cancelRequested) renderMachineProgress(lastMachinePercent);
    }, 1000);
  }

  function showMessage(message, type) {
    elements.message.textContent = message || '';
    elements.message.className = 'message' + (type ? ' ' + type : '');
  }

  function resetRunCleanupState() {
    activeRunDocumentId = '';
    activeRunSkyMaskToken = '';
    activeRunLayerIds = [];
  }

  function appendProcessLog(currentLog, text) {
    return (currentLog + String(text || '')).slice(-maxProcessLogLength);
  }

  function setSettingsOpen(open) {
    if (open) {
      elements.helpCard.classList.add('hidden');
      elements.helpButton.classList.remove('is-open');
      elements.helpButton.setAttribute('aria-expanded', 'false');
    }
    elements.settingsCard.classList.toggle('hidden', !open);
    elements.mainContent.classList.toggle('hidden', open);
    elements.settingsButton.classList.toggle('is-open', open);
    elements.settingsButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) window.setTimeout(function () { elements.exePath.focus(); }, 0);
  }

  function setHelpOpen(open) {
    if (open) {
      elements.settingsCard.classList.add('hidden');
      elements.settingsButton.classList.remove('is-open');
      elements.settingsButton.setAttribute('aria-expanded', 'false');
    }
    elements.helpCard.classList.toggle('hidden', !open);
    elements.mainContent.classList.toggle('hidden', open);
    elements.helpButton.classList.toggle('is-open', open);
    elements.helpButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) window.setTimeout(function () { elements.closeHelp.focus(); }, 0);
  }

  function setDetailsOpen(open) {
    elements.detailsPanel.classList.toggle('hidden', !open);
    elements.detailsToggle.classList.toggle('active', open);
    elements.detailsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    elements.detailsToggleText.textContent = open ? '세부 설정 닫기' : '세부 설정 보기';
    elements.detailsChevron.textContent = open ? '▴' : '▾';
  }

  function setStretchDetailsOpen(open) {
    elements.stretchDetailsPanel.classList.toggle('hidden', !open);
    elements.stretchDetailsToggle.classList.toggle('active', open);
    elements.stretchDetailsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    elements.stretchDetailsToggleText.textContent = open ? '세부 설정 닫기' : '세부 설정 보기';
    elements.stretchDetailsChevron.textContent = open ? '▴' : '▾';
  }

  function updateRunButton() {
    var target = document.querySelector('input[name="processingTarget"]:checked');
    var layerReady = !target || target.value !== 'layer' || activeLayerInfo.supported;
    var skyReady = !target || target.value !== 'sky' || activeLayerInfo.hasSelection || activeLayerInfo.hasMask;
    elements.runButton.disabled = running || stretchRunning || !documentAvailable || !layerReady || !skyReady ||
      !executableAvailable || !selectedResults(null).length;
  }

  function setStatus(element, baseClass, message, state) {
    element.textContent = message;
    element.className = baseClass + (state ? ' ' + state : '');
  }

  function updateTargetStatus() {
    var target = document.querySelector('input[name="processingTarget"]:checked');
    var layerMode = target && target.value === 'layer';
    var skyMode = target && target.value === 'sky';
    var statusClass = 'preflight-status scope-hint';
    if (!documentAvailable) {
      setStatus(elements.targetStatus, statusClass, 'Photoshop 문서를 먼저 여세요.', 'error');
    } else if (skyMode && activeLayerInfo.hasSelection) {
      setStatus(elements.targetStatus, statusClass, '준비됨 · 선택 영역으로 결과 적용 범위를 제한합니다.', '');
    } else if (skyMode && activeLayerInfo.hasMask) {
      setStatus(elements.targetStatus, statusClass, '준비됨 · 현재 레이어 마스크로 결과 적용 범위를 제한합니다.', '');
    } else if (skyMode) {
      setStatus(elements.targetStatus, statusClass, '사용 불가 · 선택 영역 또는 현재 레이어 마스크가 필요합니다.', 'error');
    } else if (!layerMode) {
      setStatus(elements.targetStatus, statusClass, '준비됨 · 현재 보이는 모든 레이어를 합성합니다.', '');
    } else if (!activeLayerInfo.supported) {
      setStatus(elements.targetStatus, statusClass, '사용 불가 · 일반 픽셀 레이어를 선택하세요.', 'error');
    } else if (activeLayerInfo.coverage === 'PARTIAL') {
      setStatus(elements.targetStatus, statusClass, '사용 가능 · 빈 영역은 검정으로 채워집니다.', 'warning');
    } else {
      setStatus(elements.targetStatus, statusClass, '준비됨 · 전체 프레임 픽셀 레이어입니다.', '');
    }
  }

  function updateStretchStatus() {
    var statusClass = 'preflight-status scope-hint';
    var ready = documentAvailable && activeLayerInfo.supported;
    if (!documentAvailable) {
      setStatus(elements.stretchScopeHint, statusClass, 'Photoshop 문서를 먼저 여세요.', 'error');
    } else if (!activeLayerInfo.supported) {
      setStatus(elements.stretchScopeHint, statusClass, '사용 불가 · 일반 픽셀 레이어를 선택하세요.', 'error');
    } else if (stretchSettings.skyOnly && activeLayerInfo.hasSelection) {
      setStatus(elements.stretchScopeHint, statusClass, '준비됨 · 선택 영역으로 결과 범위를 제한합니다.', '');
    } else if (stretchSettings.skyOnly && activeLayerInfo.hasMask) {
      setStatus(elements.stretchScopeHint, statusClass, '준비됨 · 현재 레이어 마스크로 결과 범위를 제한합니다.', '');
    } else if (stretchSettings.skyOnly) {
      ready = false;
      setStatus(elements.stretchScopeHint, statusClass, '사용 불가 · 선택 영역 또는 현재 레이어 마스크가 필요합니다.', 'error');
    } else if (activeLayerInfo.coverage === 'PARTIAL') {
      setStatus(elements.stretchScopeHint, statusClass, '사용 가능 · 빈 영역은 검정으로 채워집니다.', 'warning');
    } else {
      setStatus(elements.stretchScopeHint, statusClass, '준비됨 · 전체 프레임 픽셀 레이어입니다.', '');
    }
    var busy = running || stretchRunning;
    elements.createStretchLayer.disabled = busy || !ready;
    elements.openStretchEditor.disabled = busy || !documentAvailable || !activeLayerInfo.supported;
    elements.stretchDetailsToggle.disabled = busy;
    var controls = document.querySelectorAll('input[name=stretchScope]');
    for (var index=0; index<controls.length; index++) controls[index].disabled = busy;
  }

  function setConfigurationDisabled(disabled) {
    var controls = document.querySelectorAll(
      'input[name="processingTarget"], #importStarless, #importStars, #importBoost, #upsample, #largeStarStrength, #exePath, #browsePath, #savePath, #helpButton, #closeHelp, #settingsButton, #closeSettings, #detailsToggle, #starNetTab, #stretchTab'
    );
    for (var index = 0; index < controls.length; index++) controls[index].disabled = disabled;
  }

  function scriptCall(name, args, callback) {
    var script = name + '(' + args.map(function (arg) { return JSON.stringify(arg); }).join(',') + ')';
    if (csInterface) {
      csInterface.evalScript(script, callback);
    } else if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
      window.__adobe_cep__.evalScript(script, callback);
    } else {
      callback('ERROR|Photoshop CEP host is unavailable');
    }
  }

  function detectDocument() {
    if (running || stretchRunning || detectingDocument) return;
    detectingDocument = true;
    scriptCall('ST_getActiveDocumentInfo', [], function (result) {
      detectingDocument = false;
      var parts = (result || '').split('|');
      if (parts[0] === 'OK') {
        documentAvailable = true;
        activeLayerInfo = {
          supported: parts[5] === '1',
          coverage: parts[6] || 'UNSUPPORTED',
          hasSelection: parts[7] === '1',
          hasMask: parts[8] === '1',
          documentId: Number(parts[9]) || 0,
          layerId: Number(parts[10]) || 0
        };
      } else {
        documentAvailable = false;
        activeLayerInfo = { supported: false, coverage: 'UNSUPPORTED', hasSelection: false, hasMask: false, documentId:0, layerId:0 };
      }
      updateTargetStatus();
      updateStretchStatus();
      updateRunButton();
    });
  }

  function finishExecutableValidation(token, available, message, state) {
    if (token !== executableValidationToken) return;
    executableAvailable = available;
    setStatus(elements.exeStatus, 'preflight-status', message, state);
    elements.settingsButton.classList.toggle('needs-attention', !available);
    elements.settingsButton.title = available ? '설정' : '설정 · StarNet2 실행 파일 확인 필요';
    updateRunButton();
  }

  function validateExecutableVersion(executable, token) {
    childProcess.execFile(executable, ['--version'], { windowsHide: true, timeout: 5000 }, function (error, stdout, stderr) {
      if (token !== executableValidationToken) return;
      var output = String(stdout || '') + '\n' + String(stderr || '');
      var match = output.match(/StarNet2\s+v?([0-9]+(?:\.[0-9]+)+)/i);
      if (!error && match) {
        var compatible = /^2\.(?:5|6)(?:\.|$)/.test(match[1]);
        finishExecutableValidation(token, true, '확인됨 · StarNet2 ' + match[1] + (compatible ? '' : ' · 호환성 미확인'), compatible ? '' : 'warning');
      } else {
        finishExecutableValidation(token, false, '실행 파일을 찾을 수 없거나 StarNet2가 아닙니다.', 'error');
      }
    });
  }

  function validateExecutable() {
    if (running || !childProcess) return;
    if (executableValidationTimer) window.clearTimeout(executableValidationTimer);
    executableValidationTimer = null;
    var executable = elements.exePath.value.trim() || 'starnet2.exe';
    var token = ++executableValidationToken;
    executableAvailable = false;
    elements.settingsButton.classList.remove('needs-attention');
    setStatus(elements.exeStatus, 'preflight-status', 'StarNet2 정보를 확인하고 있습니다.', 'checking');
    updateRunButton();
    childProcess.execFile(executable, ['--machine-info'], { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 }, function (error, stdout) {
      if (token !== executableValidationToken) return;
      if (!error) {
        try {
          var info = JSON.parse(stdout);
          if (info.product === 'starnet2' && info.version) {
            var compatible = /^2\.(?:5|6)(?:\.|$)/.test(info.version);
            var backend = info.backend && info.backend.display_name ? ' · ' + info.backend.display_name : '';
            finishExecutableValidation(token, true, '확인됨 · StarNet2 ' + info.version + backend + (compatible ? '' : ' · 호환성 미확인'), compatible ? '' : 'warning');
            return;
          }
        } catch (parseError) {}
      }
      validateExecutableVersion(executable, token);
    });
  }

  function scheduleExecutableValidation() {
    if (executableValidationTimer) window.clearTimeout(executableValidationTimer);
    executableAvailable = false;
    elements.settingsButton.classList.remove('needs-attention');
    setStatus(elements.exeStatus, 'preflight-status', '경로 변경을 확인하고 있습니다.', 'checking');
    updateRunButton();
    executableValidationTimer = window.setTimeout(validateExecutable, 400);
  }

  function useExecutablePath(filePath) {
    if (!filePath) return;
    elements.exePath.value = filePath;
    try { localStorage.setItem('starnet2.exePath', filePath); } catch (error) {}
    showMessage('StarNet2 실행 파일을 선택하고 확인합니다.', 'ok');
    validateExecutable();
  }

  function browseExecutable() {
    if (running) return;
    try {
      if (window.cep && window.cep.fs && typeof window.cep.fs.showOpenDialog === 'function') {
        var currentPath = elements.exePath.value.trim();
        var initialPath = path && path.isAbsolute(currentPath) ? path.dirname(currentPath) : '';
        var selection = window.cep.fs.showOpenDialog(false, false, 'StarNet2 실행 파일 선택', initialPath, ['exe']);
        if (selection && selection.data && selection.data.length) useExecutablePath(selection.data[0]);
        else if (selection && selection.err) showMessage('파일 선택 창을 열 수 없습니다: ' + selection.err, 'error');
        return;
      }
    } catch (error) {
      showMessage('파일 선택 창 오류: ' + error.message, 'error');
      return;
    }
    elements.exeFilePicker.value = '';
    elements.exeFilePicker.click();
  }

  function tempFolder() {
    return path.join(os.tmpdir(), 'StarNet2-Photoshop');
  }

  function tempFiles() {
    var token = 'starnet2_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var folder = tempFolder();
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
    return {
      input: path.join(folder, token + '_input.tif'),
      starless: path.join(folder, token + '_starless.tif'),
      stars: path.join(folder, token + '_stars.tif')
    };
  }

  function removeFiles(files) {
    if (!fs || !files) return;
    Object.keys(files).forEach(function (key) {
      try { if (fs.existsSync(files[key])) fs.unlinkSync(files[key]); } catch (error) {}
    });
  }

  function cleanupStaleTempFiles() {
    if (!fs || !path || !os) return;
    var folder = tempFolder();
    if (!fs.existsSync(folder)) return;
    var cutoff = Date.now() - (24 * 60 * 60 * 1000);
    try {
      fs.readdirSync(folder).forEach(function (name) {
        if (!/^starnet2_.*_(input|starless|stars|mask|output)\.tif$/i.test(name) &&
            !/^stretch_preview_.*\.jpg$/i.test(name)) return;
        var filePath = path.join(folder, name);
        try {
          if (fs.statSync(filePath).mtime.getTime() < cutoff) fs.unlinkSync(filePath);
        } catch (error) {}
      });
    } catch (error) {}
  }

  function selectedResults(files) {
    var results = [];
    if (document.getElementById('importStarless').checked) results.push([files && files.starless, 'Starless']);
    if (document.getElementById('importStars').checked) results.push([files && files.stars, 'Stars']);
    if (document.getElementById('importBoost').checked) results.push([files && files.stars, 'Star Boost (Large)']);
    return results;
  }

  function importResult(files, documentId, anchorLayerId, profileMode, profileName, skyMaskToken, largeStarStrength, callback) {
    var imports = selectedResults(files);
    var importedLayerIds = [];
    var placementAnchorId = anchorLayerId;
    var starsLayerId = null;

    function fail(error) {
      if (!importedLayerIds.length) { callback(error); return; }
      scriptCall('ST_removeResultLayers', [documentId, importedLayerIds], function (result) {
        if ((result || '').indexOf('OK|') !== 0) {
          error.message += '\n추가된 일부 결과 레이어를 자동으로 제거하지 못했습니다: ' + result;
        }
        callback(error);
      });
    }

    function next(index) {
      if (cancelRequested) { fail(new Error('CANCELLED')); return; }
      if (index >= imports.length) { callback(null, imports.map(function (item) { return item[1]; })); return; }
      var item = imports[index];
      var method = item[1] === 'Star Boost (Large)' && starsLayerId ? 'ST_createLargeStarBoost' : 'ST_importResult';
      var methodArgs = method === 'ST_createLargeStarBoost'
        ? [documentId, starsLayerId, placementAnchorId, largeStarStrength]
        : [item[0], documentId, item[1], placementAnchorId, profileMode, profileName, skyMaskToken, largeStarStrength];
      scriptCall(method, methodArgs, function (result) {
        var parts = (result || '').split('|');
        if (parts[0] !== 'OK') { fail(new Error(result)); return; }
        placementAnchorId = Number(parts[1]);
        if (item[1] === 'Stars') starsLayerId = placementAnchorId;
        importedLayerIds.push(placementAnchorId);
        activeRunLayerIds = importedLayerIds.slice();
        if (cancelRequested) { fail(new Error('CANCELLED')); return; }
        next(index + 1);
      });
    }
    next(0);
  }

  function finalizeSkyMask(documentId, skyMaskToken, callback) {
    if (!skyMaskToken) { callback(null); return; }
    scriptCall('ST_finalizeSkyMask', [documentId, skyMaskToken], function (result) {
      if (result !== 'OK') callback(new Error(result || '지정 영역 임시 데이터 정리에 실패했습니다.'));
      else callback(null);
    });
  }

  function finish(message, type) {
    stopProgressTimer();
    running = false;
    activeProcess = null;
    currentFiles = null;
    resetRunCleanupState();
    cancelRequested = false;
    setConfigurationDisabled(false);
    elements.runButton.classList.remove('hidden');
    elements.cancelButton.classList.add('hidden');
    elements.cancelButton.disabled = false;
    elements.runText.textContent = 'StarNet2 실행';
    if (type) {
      setProgress(type === 'ok' ? '완료' : '중단됨', type === 'ok' ? 100 : 0);
      showMessage(message, type);
    } else {
      elements.progressWrap.classList.add('hidden');
      showMessage(message, '');
    }
    updateRunButton();
    detectDocument();
  }

  function cancelProcess() {
    if (!running || cancelRequested) return;
    cancelRequested = true;
    elements.cancelButton.disabled = true;
    setProgress('취소 중… · ' + formatElapsed(), parseFloat(elements.progressBar.style.width) || 0);
    if (activeProcess) {
      try { activeProcess.kill(); } catch (error) {}
    }
  }

  function runProcess() {
    if (running || stretchRunning) return;
    if ((!csInterface && !(window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function')) || !childProcess) {
      finish('CEP/Node 환경에서 실행하세요.', 'error');
      return;
    }
    if (!documentAvailable) {
      showMessage('Photoshop 문서를 먼저 여세요.', 'error');
      return;
    }
    var requestedTarget = document.querySelector('input[name="processingTarget"]:checked');
    if (requestedTarget && requestedTarget.value === 'layer' && !activeLayerInfo.supported) {
      showMessage('현재 레이어만 처리하려면 일반 픽셀 레이어를 선택하세요.', 'error');
      return;
    }
    if (requestedTarget && requestedTarget.value === 'sky' && !activeLayerInfo.hasSelection && !activeLayerInfo.hasMask) {
      showMessage('지정 영역을 사용하려면 선택 영역을 만들거나 현재 레이어에 마스크를 추가하세요.', 'error');
      return;
    }
    if (!executableAvailable) {
      showMessage('유효한 StarNet2 실행 파일을 지정하세요.', 'error');
      return;
    }
    if (!selectedResults(null).length) {
      showMessage('생성할 결과 레이어를 하나 이상 선택하세요.', 'error');
      return;
    }

    running = true;
    cancelRequested = false;
    runStartedAt = Date.now();
    lastMachinePercent = 0;
    resetRunCleanupState();
    setSettingsOpen(false);
    setDetailsOpen(false);
    setConfigurationDisabled(true);
    updateRunButton();
    elements.runButton.classList.add('hidden');
    elements.cancelButton.classList.remove('hidden');
    elements.runText.textContent = '처리 중…';
    showMessage('');
    setProgress('원본 문서 복제 및 TIFF 생성 중…', 8);
    var files = null;
    try {
      files = tempFiles();
    } catch (tempError) {
      finish('임시 작업 폴더를 만들 수 없습니다: ' + tempError.message, 'error');
      return;
    }
    currentFiles = files;
    var targetControl = document.querySelector('input[name="processingTarget"]:checked');
    var processingTarget = targetControl ? targetControl.value : 'layer';

    scriptCall('ST_prepareInput', [files.input, processingTarget], function (prepared) {
      var parts = (prepared || '').split('|');
      var preparedDocumentId = parts[0] === 'OK' ? parts[1] : '';
      var skyMaskToken = '';
      try { skyMaskToken = decodeURIComponent(parts[6] || ''); } catch (maskTokenError) { skyMaskToken = ''; }
      if (parts[0] === 'OK') {
        activeRunDocumentId = parts[1];
        activeRunSkyMaskToken = skyMaskToken;
      }
      if (cancelRequested) {
        removeFiles(files);
        finalizeSkyMask(preparedDocumentId, skyMaskToken, function (cleanupError) {
          finish(cleanupError ? '작업을 취소했지만 지정 영역 임시 데이터 정리에 실패했습니다: ' + cleanupError.message : '작업을 취소했습니다.', cleanupError ? 'error' : '');
        });
        return;
      }
      if (parts[0] !== 'OK') {
        removeFiles(files);
        finish(parts.slice(1).join('|') || '입력 TIFF 생성에 실패했습니다.', 'error');
        return;
      }
      var inputWarning = parts[3] === 'PARTIAL'
        ? '\n주의: 선택 레이어가 전체 프레임을 채우지 않아 빈 영역을 검정으로 채웠습니다.'
        : '';
      var profileMode = parts[4] || 'NONE';
      var profileName = '';
      try { profileName = decodeURIComponent(parts[5] || ''); } catch (profileError) { profileName = ''; }
      var largeStarStrength = Math.max(10, Math.min(100, Number(elements.largeStarStrength.value) || 60));

      var args = ['--input', files.input, '--output', files.starless, '--unscreen', files.stars, '--machine-progress'];
      if (document.getElementById('upsample').checked) args.push('--upsample');
      setProgress('StarNet2 CLI 실행 중…', 25);
      var executable = elements.exePath.value.trim() || 'starnet2.exe';
      var process = null;
      try {
        process = childProcess.spawn(executable, args, { windowsHide: true });
      } catch (spawnError) {
        removeFiles(files);
        finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
          finish('StarNet2 실행 실패: ' + spawnError.message +
            (cleanupError ? '\n지정 영역 임시 데이터 정리 실패: ' + cleanupError.message : ''), 'error');
        });
        return;
      }
      activeProcess = process;
      var processFinished = false;
      var log = '';
      var machineBuffer = '';
      renderMachineProgress(0);
      startProgressTimer();
      process.stdout.on('data', function (data) { log = appendProcessLog(log, data.toString()); });
      process.stderr.on('data', function (data) {
        var text = data.toString();
        log = appendProcessLog(log, text);
        machineBuffer += text;
        if (machineBuffer.length > maxProcessLogLength) machineBuffer = machineBuffer.slice(-maxProcessLogLength);
        var lines = machineBuffer.split(/\r?\n/);
        machineBuffer = lines.pop();
        lines.forEach(function (line) {
          line = line.replace(/^\s+|\s+$/g, '');
          if (line.charAt(0) !== '{') return;
          try {
            var event = JSON.parse(line);
            if (event.schema === 'starnetastro.cli.progress.v1' && typeof event.percent === 'number') {
              renderMachineProgress(event.percent);
            }
          } catch (error) {}
        });
      });
      process.on('error', function (error) {
        if (processFinished) return;
        processFinished = true;
        activeProcess = null;
        stopProgressTimer();
        removeFiles(files);
        finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
          if (cancelRequested && !cleanupError) finish('작업을 취소했습니다.', '');
          else finish((cancelRequested ? '작업 취소 후 정리 실패: ' : 'StarNet2 실행 실패: ') + (cleanupError ? cleanupError.message : error.message), 'error');
        });
      });
      process.on('close', function (code) {
        if (processFinished) return;
        processFinished = true;
        activeProcess = null;
        stopProgressTimer();
        if (cancelRequested) {
          removeFiles(files);
          finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
            finish(cleanupError ? '작업을 취소했지만 지정 영역 임시 데이터 정리에 실패했습니다: ' + cleanupError.message : '작업을 취소했습니다.', cleanupError ? 'error' : '');
          });
          return;
        }
        if (code !== 0) {
          removeFiles(files);
          var backendHint = code === 4294967295 && /DirectML|Resize node|80070057/i.test(log)
            ? '\n\nDirectML Resize 오류입니다. GPU 드라이버를 업데이트하거나 CPU 전용 StarNet2 실행 파일의 전체 경로를 입력하세요.'
            : '';
          finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
            finish('StarNet2가 오류 코드 ' + code + '으로 종료되었습니다.' + backendHint + '\n' + log.slice(-1000) +
              (cleanupError ? '\n지정 영역 임시 데이터 정리 실패: ' + cleanupError.message : ''), 'error');
          });
          return;
        }
        var missing = selectedResults(files).filter(function (item) { return !fs.existsSync(item[0]); });
        if (missing.length) {
          removeFiles(files);
          finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
            finish('StarNet2가 결과 파일을 생성하지 않았습니다: ' + missing.map(function (item) { return item[1]; }).join(', ') +
              (cleanupError ? '\n지정 영역 임시 데이터 정리 실패: ' + cleanupError.message : ''), 'error');
          });
          return;
        }
        setProgress('결과 레이어 생성 중… · ' + formatElapsed(), 90);
        importResult(files, parts[1], parts[2] || '', profileMode, profileName, skyMaskToken, largeStarStrength, function (error, importedNames) {
          removeFiles(files);
          finalizeSkyMask(parts[1], skyMaskToken, function (cleanupError) {
            if (cancelRequested || (error && error.message === 'CANCELLED')) {
              finish(cleanupError ? '작업을 취소했지만 지정 영역 임시 데이터 정리에 실패했습니다: ' + cleanupError.message : '작업을 취소했습니다.', cleanupError ? 'error' : '');
            } else if (error) {
              finish('결과 레이어 생성 실패: ' + error.message + (cleanupError ? '\n지정 영역 임시 데이터 정리 실패: ' + cleanupError.message : ''), 'error');
            } else if (cleanupError) {
              finish('결과 레이어는 추가했지만 지정 영역 임시 데이터 정리에 실패했습니다: ' + cleanupError.message, 'error');
            } else {
              finish(importedNames.join(', ') + ' 레이어를 추가했습니다.' + (skyMaskToken ? '\n지정 영역 마스크를 적용했습니다.' : '') + inputWarning, 'ok');
            }
          });
        });
      });
    });
  }

  function setFeature(feature) {
    activeFeature = feature === 'stretch' ? 'stretch' : 'starnet';
    elements.starNetPanel.classList.toggle('hidden', activeFeature !== 'starnet');
    elements.stretchPanel.classList.toggle('hidden', activeFeature !== 'stretch');
    elements.starNetTab.classList.toggle('active', activeFeature === 'starnet');
    elements.stretchTab.classList.toggle('active', activeFeature === 'stretch');
    if (activeFeature === 'stretch') updateStretchStatus();
  }

  function stretchExchangeFile(name) {
    var folder = tempFolder();
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
    return path.join(folder, name);
  }

  function updateStretchSummary() {
    elements.stretchSummary.textContent = stretchSettings.preset + ' · Strength ' +
      Math.round(stretchSettings.strength) + '% · Saturation ' + Number(stretchSettings.saturation).toFixed(1);
    var controls = document.querySelectorAll('input[name="stretchScope"]');
    for (var index=0; index<controls.length; index++) controls[index].checked = controls[index].value === (stretchSettings.skyOnly ? 'sky' : 'layer');
  }

  function writeStretchState() {
    if (!fs || !stretchPreviewInfo || !stretchPreviewFile) return;
    var state = {
      sessionId:stretchSessionId,
      source:'현재 레이어 · ' + stretchPreviewInfo.width + ' × ' + stretchPreviewInfo.height,
      previewFile:stretchPreviewFile, preset:stretchSettings.preset,
      strength:stretchSettings.strength, saturation:stretchSettings.saturation,
      skyOnly:stretchSettings.skyOnly, documentId:stretchPreviewInfo.documentId,
      layerId:stretchPreviewInfo.layerId, updatedAt:Date.now()
    };
    try { fs.writeFileSync(stretchExchangeFile('stretch_editor_state.json'), JSON.stringify(state), 'utf8'); } catch (_) {}
  }

  function openStretchEditor() {
    if (!fs || !path || !documentAvailable || !activeLayerInfo.supported) {
      elements.stretchMessage.textContent = '일반 픽셀 레이어를 선택하세요.';
      elements.stretchMessage.className = 'message error';
      return;
    }
    var oldPreviewFile = stretchPreviewFile;
    stretchPreviewFile = stretchExchangeFile('stretch_preview_' + Date.now() + '.jpg');
    if (oldPreviewFile && oldPreviewFile !== stretchPreviewFile) removeFiles({preview:oldPreviewFile});
    elements.stretchMessage.textContent = 'Stretch Preview를 준비하고 있습니다.';
    elements.stretchMessage.className = 'message';
    scriptCall('ST_prepareStretchPreview', [stretchPreviewFile, 1200, 900], function (result) {
      var parts = (result || '').split('|');
      if (parts[0] !== 'OK') {
        elements.stretchMessage.textContent = parts.slice(1).join('|') || 'Preview 생성에 실패했습니다.';
        elements.stretchMessage.className = 'message error';
        return;
      }
      stretchPreviewInfo = { documentId:Number(parts[1]), layerId:Number(parts[2]), width:Number(parts[3]), height:Number(parts[4]) };
      writeStretchState();
      elements.stretchMessage.textContent = '';
      try {
        if (window.__adobe_cep__ && window.__adobe_cep__.requestOpenExtension) {
          window.__adobe_cep__.requestOpenExtension('com.drmedia.starnet.stretcheditor', '');
        } else {
          window.open('stretch-editor-window.html','StarNet2StretchEditor','width=1100,height=800,resizable=yes,scrollbars=no');
        }
      } catch (error) {
        elements.stretchMessage.textContent = 'Stretch Editor 열기 실패: ' + error.message;
        elements.stretchMessage.className = 'message error';
      }
    });
  }

  function finishStretch(message, type) {
    stretchRunning = false;
    stretchCancelRequested = false;
    elements.createStretchLayer.disabled = false;
    elements.createStretchLayer.classList.remove('hidden');
    elements.openStretchEditor.disabled = false;
    elements.cancelStretch.disabled = false;
    elements.cancelStretch.classList.add('hidden');
    elements.stretchProgress.classList.add('hidden');
    elements.stretchMessage.textContent = message || '';
    elements.stretchMessage.className = 'message' + (type ? ' ' + type : '');
    updateRunButton();
    updateStretchStatus();
    detectDocument();
  }

  function cancelStretch() {
    if (!stretchRunning || stretchCancelRequested) return;
    stretchCancelRequested = true;
    elements.cancelStretch.disabled = true;
    elements.stretchStatus.textContent = 'Stretch 취소 중…';
  }

  function runStretch(expectedTarget) {
    if (stretchRunning || running) return;
    if (!fs || !window.StarNetStretchProcessor ||
        typeof window.StarNetStretchProcessor.stretchTiffAsync !== 'function' ||
        !documentAvailable || !activeLayerInfo.supported) {
      finishStretch('일반 픽셀 레이어를 선택하세요.', 'error'); return;
    }
    var settings = {
      preset:stretchSettings.preset,
      strength:window.StarNetStretchProcessor.normalizeStrength(stretchSettings.strength),
      saturation:window.StarNetStretchProcessor.normalizeSaturation(stretchSettings.saturation),
      skyOnly:!!stretchSettings.skyOnly
    };
    var target = expectedTarget && expectedTarget.documentId && expectedTarget.layerId ? expectedTarget : {
      documentId:activeLayerInfo.documentId,
      layerId:activeLayerInfo.layerId
    };
    if (!target.documentId || !target.layerId) {
      finishStretch('처리할 문서와 레이어를 다시 선택하세요.', 'error'); return;
    }
    if (settings.skyOnly && !activeLayerInfo.hasSelection && !activeLayerInfo.hasMask) {
      finishStretch('지정 영역에는 Photoshop 선택 영역 또는 현재 레이어 마스크가 필요합니다.', 'error'); return;
    }
    stretchRunning = true;
    stretchCancelRequested = false;
    elements.createStretchLayer.disabled = true; elements.openStretchEditor.disabled = true;
    elements.createStretchLayer.classList.add('hidden');
    elements.cancelStretch.disabled = false; elements.cancelStretch.classList.remove('hidden');
    updateStretchStatus();
    updateRunButton();
    elements.stretchProgress.classList.remove('hidden'); elements.stretchProgressBar.style.width='10%';
    elements.stretchStatus.textContent='16-bit TIFF 준비 중…'; elements.stretchMessage.textContent='';
    var token='starnet2_stretch_'+Date.now(), folder=tempFolder();
    var input=path.join(folder,token+'_input.tif'), output=path.join(folder,token+'_output.tif');
    scriptCall('ST_prepareInput',[input,settings.skyOnly?'layer-sky':'layer',target.documentId,target.layerId],function(prepared){
      var parts=(prepared||'').split('|'), maskToken='';
      try { maskToken=decodeURIComponent(parts[6]||''); } catch(_) {}
      if(parts[0]!=='OK'){removeFiles({input:input,output:output});finishStretch(parts.slice(1).join('|')||'입력 TIFF 생성 실패','error');return;}
      var profileName='';try{profileName=decodeURIComponent(parts[5]||'');}catch(_){}
      if(stretchCancelRequested){
        removeFiles({input:input,output:output});
        finalizeSkyMask(parts[1],maskToken,function(){finishStretch('Stretch 처리를 취소했습니다.','');});
        return;
      }
      elements.stretchProgressBar.style.width='45%';elements.stretchStatus.textContent='Stretch 계산 중…';
      window.StarNetStretchProcessor.stretchTiffAsync(fs,input,output,settings.preset,settings.saturation,settings.strength,{
        isCancelled:function(){return stretchCancelRequested;},
        onProgress:function(percent){
          elements.stretchProgressBar.style.width=(45+percent*0.4)+'%';
          elements.stretchStatus.textContent='Stretch 계산 중… '+Math.round(percent)+'%';
        }
      },function(error){
        if(error){
          removeFiles({input:input,output:output});
          finalizeSkyMask(parts[1],maskToken,function(){finishStretch(error.cancelled?'Stretch 처리를 취소했습니다.':('Stretch 처리 실패: '+error.message),error.cancelled?'':'error');});
          return;
        }
        elements.stretchProgressBar.style.width='85%';elements.stretchStatus.textContent='결과 레이어 생성 중…';
        elements.cancelStretch.disabled=true;
        var name='Stretched ('+settings.preset+', Strength '+Math.round(settings.strength)+'%, Saturation '+Number(settings.saturation).toFixed(1)+')';
        scriptCall('ST_importResult',[output,parts[1],name,parts[2]||'',parts[4]||'NONE',profileName,maskToken,100],function(imported){
          removeFiles({input:input,output:output});finalizeSkyMask(parts[1],maskToken,function(cleanupError){
            var ok=(imported||'').indexOf('OK|')===0;
            finishStretch(ok&&!cleanupError?'Stretched 레이어를 활성 레이어 바로 위에 생성했습니다.':('결과 생성 실패: '+(cleanupError?cleanupError.message:imported)),ok&&!cleanupError?'ok':'error');
          });
        });
      });
    });
  }

  function pollStretchCommand() {
    if (!fs || !path || !os) return;
    var file;
    try { file=stretchExchangeFile('stretch_editor_command.json'); if(!fs.existsSync(file))return; var command=JSON.parse(fs.readFileSync(file,'utf8')); fs.unlinkSync(file);
      if(command.sessionId!==stretchSessionId)return;
      if(command.id&&command.id===lastStretchCommandId)return; lastStretchCommandId=command.id||'';
      if(command.action==='settings'&&command.value){stretchSettings.preset=command.value.preset||stretchSettings.preset;stretchSettings.strength=window.StarNetStretchProcessor.normalizeStrength(command.value.strength);stretchSettings.saturation=window.StarNetStretchProcessor.normalizeSaturation(command.value.saturation);stretchSettings.skyOnly=!!command.value.skyOnly;updateStretchSummary();updateStretchStatus();writeStretchState();}
      else if(command.action==='create'){
        if(command.value){stretchSettings.preset=command.value.preset||stretchSettings.preset;stretchSettings.strength=window.StarNetStretchProcessor.normalizeStrength(command.value.strength);stretchSettings.saturation=window.StarNetStretchProcessor.normalizeSaturation(command.value.saturation);stretchSettings.skyOnly=!!command.value.skyOnly;updateStretchSummary();updateStretchStatus();writeStretchState();}
        runStretch({documentId:Number(command.value&&command.value.documentId)||0,layerId:Number(command.value&&command.value.layerId)||0});
      }
    } catch(_) {}
  }

  document.getElementById('savePath').addEventListener('click', function () {
    try { localStorage.setItem('starnet2.exePath', elements.exePath.value.trim() || 'starnet2.exe'); } catch (error) {}
    showMessage('StarNet2 실행 파일 경로를 저장하고 확인합니다.', 'ok');
    validateExecutable();
  });
  elements.settingsButton.addEventListener('click', function () {
    setSettingsOpen(elements.settingsCard.classList.contains('hidden'));
  });
  elements.closeSettings.addEventListener('click', function () { setSettingsOpen(false); });
  elements.helpButton.addEventListener('click', function () {
    setHelpOpen(elements.helpCard.classList.contains('hidden'));
  });
  elements.closeHelp.addEventListener('click', function () { setHelpOpen(false); });
  elements.detailsToggle.addEventListener('click', function () {
    setDetailsOpen(elements.detailsPanel.classList.contains('hidden'));
  });
  elements.stretchDetailsToggle.addEventListener('click', function () {
    setStretchDetailsOpen(elements.stretchDetailsPanel.classList.contains('hidden'));
  });
  elements.largeStarStrength.addEventListener('input', function () {
    elements.largeStarStrengthValue.textContent = elements.largeStarStrength.value + '%';
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      if (!elements.helpCard.classList.contains('hidden')) setHelpOpen(false);
      else if (!elements.settingsCard.classList.contains('hidden')) setSettingsOpen(false);
    }
  });
  elements.exePath.addEventListener('input', scheduleExecutableValidation);
  elements.browsePath.addEventListener('click', browseExecutable);
  elements.exeFilePicker.addEventListener('change', function () {
    var file = elements.exeFilePicker.files && elements.exeFilePicker.files[0];
    var selectedPath = file && file.path ? file.path : elements.exeFilePicker.value;
    if (selectedPath && selectedPath.indexOf('fakepath') === -1) useExecutablePath(selectedPath);
    else if (selectedPath) showMessage('선택한 파일의 전체 경로를 가져올 수 없습니다.', 'error');
  });
  var targetControls = document.querySelectorAll('input[name="processingTarget"]');
  for (var targetIndex = 0; targetIndex < targetControls.length; targetIndex++) {
    (function (targetControl) {
      var targetLabel = targetControl.parentNode;
      targetControl.addEventListener('change', function () { updateTargetStatus(); updateRunButton(); });
      targetControl.addEventListener('focus', function () {
        setStatus(elements.targetStatus, 'preflight-status scope-hint', targetLabel.getAttribute('data-description') || '', '');
      });
      targetControl.addEventListener('blur', updateTargetStatus);
      targetLabel.addEventListener('mouseenter', function () {
        setStatus(elements.targetStatus, 'preflight-status scope-hint', targetLabel.getAttribute('data-description') || '', '');
      });
      targetLabel.addEventListener('mouseleave', updateTargetStatus);
    }(targetControls[targetIndex]));
  }
  var resultControls = document.querySelectorAll('#importStarless, #importStars, #importBoost');
  for (var resultIndex = 0; resultIndex < resultControls.length; resultIndex++) {
    resultControls[resultIndex].addEventListener('change', updateRunButton);
  }
  elements.runButton.addEventListener('click', runProcess);
  elements.cancelButton.addEventListener('click', cancelProcess);
  elements.starNetTab.addEventListener('click', function(){setFeature('starnet');});
  elements.stretchTab.addEventListener('click', function(){setFeature('stretch');});
  elements.openStretchEditor.addEventListener('click', openStretchEditor);
  elements.createStretchLayer.addEventListener('click', function(){runStretch();});
  elements.cancelStretch.addEventListener('click', cancelStretch);
  var stretchScopeControls=document.querySelectorAll('input[name="stretchScope"]');
  for(var stretchScopeIndex=0;stretchScopeIndex<stretchScopeControls.length;stretchScopeIndex++){
    stretchScopeControls[stretchScopeIndex].addEventListener('change',function(){stretchSettings.skyOnly=this.value==='sky';updateStretchSummary();updateStretchStatus();writeStretchState();});
  }
  try { elements.exePath.value = localStorage.getItem('starnet2.exePath') || 'starnet2.exe'; } catch (error) {}
  cleanupStaleTempFiles();
  try { var staleStretchCommand=stretchExchangeFile('stretch_editor_command.json'); if(fs.existsSync(staleStretchCommand))fs.unlinkSync(staleStretchCommand); } catch (_) {}
  updateStretchSummary();
  updateStretchStatus();
  window.setInterval(pollStretchCommand,250);
  detectDocument();
  validateExecutable();
  window.setInterval(detectDocument, 1500);
  window.addEventListener('beforeunload', function () {
    try { if (activeProcess) activeProcess.kill(); } catch (error) {}
    removeFiles(currentFiles);
    removeFiles({preview:stretchPreviewFile});
    if (activeRunDocumentId) {
      var cleanupScript = 'ST_abortRun(' + [activeRunDocumentId, activeRunSkyMaskToken, activeRunLayerIds]
        .map(function (arg) { return JSON.stringify(arg); }).join(',') + ')';
      try {
        if (csInterface) csInterface.evalScript(cleanupScript);
        else if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
          window.__adobe_cep__.evalScript(cleanupScript);
        }
      } catch (error) {}
    }
  });
}());
