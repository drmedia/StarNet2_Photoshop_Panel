#target photoshop

function ST_getActiveDocumentInfo() {
    if (!app.documents.length) return "ERROR|No Photoshop document is open";
    var document = app.activeDocument;
    var layer = document.activeLayer;
    var isPixelLayer = ST_isPixelLayer(layer);
    var coverage = isPixelLayer
        ? (ST_layerCoversDocument(document, layer) ? "FULL" : "PARTIAL")
        : "UNSUPPORTED";
    return "OK|" +
        encodeURIComponent(document.name) + "|" +
        document.width.value.toFixed(0) + " x " + document.height.value.toFixed(0) + "|" +
        encodeURIComponent(layer.name) + "|" +
        encodeURIComponent(ST_layerTypeName(layer)) + "|" +
        (isPixelLayer ? "1" : "0") + "|" +
        coverage + "|" +
        (ST_hasSelection(document) ? "1" : "0") + "|" +
        (ST_activeLayerHasMask(document) ? "1" : "0") + "|" +
        document.id + "|" + layer.id;
}

function ST_isPixelLayer(layer) {
    return layer && layer.typename === "ArtLayer" && layer.kind === LayerKind.NORMAL;
}

function ST_layerTypeName(layer) {
    if (!layer) return "레이어 없음";
    if (layer.typename === "LayerSet") return "그룹";
    if (layer.typename !== "ArtLayer") return "지원하지 않는 레이어";
    if (layer.kind === LayerKind.NORMAL) return "픽셀 레이어";
    if (layer.kind === LayerKind.TEXT) return "텍스트 레이어";
    if (layer.kind === LayerKind.SMARTOBJECT) return "스마트 오브젝트";
    return "조정 또는 특수 레이어";
}

function ST_layerCoversDocument(document, layer) {
    try {
        var bounds = layer.bounds;
        var tolerance = 0.5;
        return bounds[0].as("px") <= tolerance &&
            bounds[1].as("px") <= tolerance &&
            bounds[2].as("px") >= document.width.as("px") - tolerance &&
            bounds[3].as("px") >= document.height.as("px") - tolerance;
    } catch (error) {
        return false;
    }
}

function ST_profileMode(document) {
    return document.colorProfileType === ColorProfile.NONE ? "NONE" : "TAGGED";
}

function ST_profileName(document) {
    return ST_profileMode(document) === "TAGGED" ? document.colorProfileName : "";
}

function ST_assignDocumentProfile(document, profileMode, profileName) {
    app.activeDocument = document;
    if (profileMode === "NONE") {
        document.colorProfileType = ColorProfile.NONE;
    } else if (profileName) {
        if (document.colorProfileType === ColorProfile.NONE) {
            document.colorProfileType = ColorProfile.WORKING;
        }
        document.colorProfileName = profileName;
    }
}

function ST_hasSelection(document) {
    try {
        var bounds = document.selection.bounds;
        return bounds && bounds.length === 4;
    } catch (error) {
        return false;
    }
}

function ST_activeLayerHasMask(document) {
    try {
        app.activeDocument = document;
        var reference = new ActionReference();
        reference.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var descriptor = executeActionGet(reference);
        var key = stringIDToTypeID("hasUserMask");
        return descriptor.hasKey(key) && descriptor.getBoolean(key);
    } catch (error) {
        return false;
    }
}

function ST_loadActiveLayerMaskAsSelection(document) {
    app.activeDocument = document;
    var descriptor = new ActionDescriptor();
    var selectionReference = new ActionReference();
    selectionReference.putProperty(charIDToTypeID("Chnl"), charIDToTypeID("fsel"));
    descriptor.putReference(charIDToTypeID("null"), selectionReference);
    var maskReference = new ActionReference();
    maskReference.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));
    descriptor.putReference(charIDToTypeID("T   "), maskReference);
    executeAction(charIDToTypeID("setd"), descriptor, DialogModes.NO);
}

function ST_addRevealSelectionMask() {
    var descriptor = new ActionDescriptor();
    descriptor.putClass(charIDToTypeID("Nw  "), charIDToTypeID("Chnl"));
    var maskReference = new ActionReference();
    maskReference.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));
    descriptor.putReference(charIDToTypeID("At  "), maskReference);
    descriptor.putEnumerated(charIDToTypeID("Usng"), charIDToTypeID("UsrM"), charIDToTypeID("RvlS"));
    executeAction(charIDToTypeID("Mk  "), descriptor, DialogModes.NO);
}

function ST_skyMaskTokenParts(maskToken) {
    var token = String(maskToken || "");
    var separator = token.indexOf(":");
    if (separator !== 1) throw new Error("지정 영역 마스크 정보가 올바르지 않습니다.");
    return { source: token.substring(0, separator), channelName: token.substring(separator + 1) };
}

function ST_findChannel(document, channelName) {
    for (var index = 0; index < document.channels.length; index++) {
        if (document.channels[index].name === channelName) return document.channels[index];
    }
    return null;
}

function ST_activateCompositeChannels(document) {
    document.activeChannels = document.componentChannels;
}

function ST_captureSkyMask(document) {
    var source = "S";
    var hadSelection = ST_hasSelection(document);
    var originalChannels = null;
    try { originalChannels = document.activeChannels; } catch (channelError) {}
    if (!hadSelection) {
        if (!ST_activeLayerHasMask(document)) {
            throw new Error("선택 영역이나 현재 레이어 마스크가 없습니다.");
        }
        ST_loadActiveLayerMaskAsSelection(document);
        if (!ST_hasSelection(document)) {
            throw new Error("현재 레이어 마스크에서 지정 영역을 불러올 수 없습니다.");
        }
        source = "M";
    }
    var channel = null;
    try {
        channel = document.channels.add();
        channel.name = "__ST_SKY_MASK_" + (new Date()).getTime();
        document.selection.store(channel, SelectionType.REPLACE);
        return source + ":" + channel.name;
    } catch (error) {
        try { if (channel) channel.remove(); } catch (removeError) {}
        throw new Error("지정 영역 임시 저장 실패: " + error.message);
    } finally {
        try {
            if (originalChannels) document.activeChannels = originalChannels;
            else ST_activateCompositeChannels(document);
        } catch (restoreChannelError) {}
        if (!hadSelection) {
            try { document.selection.deselect(); } catch (deselectError) {}
        }
    }
}

function ST_applySkyMask(document, layer, maskToken) {
    var parts = ST_skyMaskTokenParts(maskToken);
    var channel = ST_findChannel(document, parts.channelName);
    if (!channel) throw new Error("저장된 제한 영역을 찾을 수 없습니다.");
    app.activeDocument = document;
    ST_activateCompositeChannels(document);
    document.activeLayer = layer;
    document.selection.load(channel, SelectionType.REPLACE);
    ST_addRevealSelectionMask();
    ST_activateCompositeChannels(document);
}

function ST_finalizeSkyMask(documentId, maskToken) {
    if (!maskToken) return "OK";
    var document = ST_findDocumentById(Number(documentId));
    if (!document) return "ERROR|Original Photoshop document is no longer open";
    try {
        app.activeDocument = document;
        var parts = ST_skyMaskTokenParts(maskToken);
        var channel = ST_findChannel(document, parts.channelName);
        if (!channel) return "OK";
        try {
            if (parts.source === "S") document.selection.load(channel, SelectionType.REPLACE);
            else document.selection.deselect();
        } finally {
            channel.remove();
            ST_activateCompositeChannels(document);
        }
        return "OK";
    } catch (error) {
        return "ERROR|" + error.message;
    }
}

function ST_prepareInput(filePath, processingTarget, expectedDocumentId, expectedLayerId) {
    if (!app.documents.length) return "ERROR|No Photoshop document is open";
    var source = app.activeDocument;
    var mode = processingTarget === "layer" ? "layer" :
        (processingTarget === "layer-sky" ? "layer-sky" :
        (processingTarget === "sky" ? "sky" : "composite"));
    var usesActiveLayer = mode === "layer" || mode === "layer-sky";
    var usesSkyMask = mode === "sky" || mode === "layer-sky";
    var sourceLayer = source.activeLayer;
    if (expectedDocumentId !== undefined && expectedDocumentId !== "" &&
            source.id !== Number(expectedDocumentId)) {
        return "ERROR|미리보기를 만든 문서가 현재 문서가 아닙니다. Stretch Editor를 다시 여세요.";
    }
    if (expectedLayerId !== undefined && expectedLayerId !== "" &&
            sourceLayer.id !== Number(expectedLayerId)) {
        return "ERROR|미리보기를 만든 레이어가 현재 레이어가 아닙니다. Stretch Editor를 다시 여세요.";
    }
    if (usesActiveLayer && !ST_isPixelLayer(sourceLayer)) {
        return "ERROR|현재 레이어만 처리하려면 일반 픽셀 레이어를 선택하세요.";
    }
    var anchorLayerId = usesActiveLayer ? sourceLayer.id : "";
    var layerCoverage = usesActiveLayer && !ST_layerCoversDocument(source, sourceLayer) ? "PARTIAL" : "FULL";
    var working = null;
    var preparedProfileMode = "NONE";
    var preparedProfileName = "";
    var originalBackgroundColor = null;
    var originalDialogs = app.displayDialogs;
    var skyMaskToken = "";
    try {
        app.displayDialogs = DialogModes.NO;
        if (usesSkyMask) skyMaskToken = ST_captureSkyMask(source);
        if (usesActiveLayer) {
            originalBackgroundColor = app.backgroundColor;
            var black = new SolidColor();
            black.rgb.red = 0;
            black.rgb.green = 0;
            black.rgb.blue = 0;
            app.backgroundColor = black;
            var sourceProfileName = source.mode === DocumentMode.RGB ? ST_profileName(source) : "";
            if (sourceProfileName) {
                working = app.documents.add(
                    source.width,
                    source.height,
                    source.resolution,
                    "StarNet2 temporary input",
                    NewDocumentMode.RGB,
                    DocumentFill.BACKGROUNDCOLOR,
                    1.0,
                    BitsPerChannelType.SIXTEEN,
                    sourceProfileName
                );
            } else {
                working = app.documents.add(
                    source.width,
                    source.height,
                    source.resolution,
                    "StarNet2 temporary input",
                    NewDocumentMode.RGB,
                    DocumentFill.BACKGROUNDCOLOR,
                    1.0,
                    BitsPerChannelType.SIXTEEN
                );
                if (source.mode === DocumentMode.RGB && source.colorProfileType === ColorProfile.NONE) {
                    working.colorProfileType = ColorProfile.NONE;
                }
            }
            app.backgroundColor = originalBackgroundColor;
            originalBackgroundColor = null;
            app.activeDocument = source;
            sourceLayer.duplicate(working, ElementPlacement.PLACEATBEGINNING);
            app.activeDocument = working;
            working.activeLayer.visible = true;
        } else {
            working = source.duplicate("StarNet2 temporary input", false);
        }
        working.flatten();
        if (working.mode !== DocumentMode.RGB) working.changeMode(ChangeMode.RGB);
        if (working.bitsPerChannel !== BitsPerChannelType.SIXTEEN) working.bitsPerChannel = BitsPerChannelType.SIXTEEN;
        preparedProfileMode = ST_profileMode(working);
        preparedProfileName = ST_profileName(working);
        var options = new TiffSaveOptions();
        options.imageCompression = TIFFEncoding.NONE;
        options.layers = false;
        options.alphaChannels = false;
        options.embedColorProfile = preparedProfileMode === "TAGGED";
        working.saveAs(new File(filePath), options, true, Extension.LOWERCASE);
        working.close(SaveOptions.DONOTSAVECHANGES);
        return "OK|" + source.id + "|" + anchorLayerId + "|" + layerCoverage + "|" +
            preparedProfileMode + "|" + encodeURIComponent(preparedProfileName) + "|" +
            encodeURIComponent(skyMaskToken);
    } catch (error) {
        if (working) { try { working.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {} }
        try { app.activeDocument = source; } catch (activeError) {}
        if (skyMaskToken) ST_finalizeSkyMask(source.id, skyMaskToken);
        return "ERROR|" + error.message;
    } finally {
        if (originalBackgroundColor) {
            try { app.backgroundColor = originalBackgroundColor; } catch (colorError) {}
        }
        app.displayDialogs = originalDialogs;
    }
}

function ST_documentId(document) {
    return document.id;
}

function ST_findDocumentById(documentId) {
    for (var index = 0; index < app.documents.length; index++) {
        if (app.documents[index].id === documentId) return app.documents[index];
    }
    return null;
}

function ST_prepareStretchPreview(filePath, maxWidth, maxHeight) {
    if (!app.documents.length) return "ERROR|No Photoshop document is open";
    var source = app.activeDocument;
    var sourceLayer = source.activeLayer;
    if (!ST_isPixelLayer(sourceLayer)) return "ERROR|Stretch Preview에는 일반 픽셀 레이어가 필요합니다.";
    var working = null;
    var originalBackgroundColor = null;
    var originalDialogs = app.displayDialogs;
    try {
        app.displayDialogs = DialogModes.NO;
        originalBackgroundColor = app.backgroundColor;
        var black = new SolidColor();
        black.rgb.red = 0; black.rgb.green = 0; black.rgb.blue = 0;
        app.backgroundColor = black;
        var profileName = source.mode === DocumentMode.RGB ? ST_profileName(source) : "";
        if (profileName) {
            working = app.documents.add(source.width, source.height, source.resolution,
                "Stretch Preview", NewDocumentMode.RGB, DocumentFill.BACKGROUNDCOLOR,
                1.0, BitsPerChannelType.EIGHT, profileName);
        } else {
            working = app.documents.add(source.width, source.height, source.resolution,
                "Stretch Preview", NewDocumentMode.RGB, DocumentFill.BACKGROUNDCOLOR,
                1.0, BitsPerChannelType.EIGHT);
            if (source.mode === DocumentMode.RGB && source.colorProfileType === ColorProfile.NONE) {
                working.colorProfileType = ColorProfile.NONE;
            }
        }
        app.backgroundColor = originalBackgroundColor;
        originalBackgroundColor = null;
        app.activeDocument = source;
        sourceLayer.duplicate(working, ElementPlacement.PLACEATBEGINNING);
        app.activeDocument = working;
        working.activeLayer.visible = true;
        working.flatten();
        var originalWidth = Math.round(source.width.as("px"));
        var originalHeight = Math.round(source.height.as("px"));
        var scale = Math.min(1, Number(maxWidth) / originalWidth, Number(maxHeight) / originalHeight);
        var previewWidth = Math.max(1, Math.round(originalWidth * scale));
        var previewHeight = Math.max(1, Math.round(originalHeight * scale));
        working.resizeImage(UnitValue(previewWidth, "px"), UnitValue(previewHeight, "px"), null, ResampleMethod.BICUBICSHARPER);
        var jpeg = new JPEGSaveOptions();
        jpeg.quality = 9;
        jpeg.embedColorProfile = profileName !== "";
        working.saveAs(new File(filePath), jpeg, true, Extension.LOWERCASE);
        return "OK|" + source.id + "|" + sourceLayer.id + "|" + originalWidth + "|" + originalHeight +
            "|" + previewWidth + "|" + previewHeight;
    } catch (error) {
        return "ERROR|" + error.message;
    } finally {
        if (working) { try { working.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {} }
        try { app.activeDocument = source; } catch (activeError) {}
        if (originalBackgroundColor) { try { app.backgroundColor = originalBackgroundColor; } catch (colorError) {} }
        app.displayDialogs = originalDialogs;
    }
}

function ST_findLayerById(container, layerId) {
    for (var index = 0; index < container.layers.length; index++) {
        var layer = container.layers[index];
        if (layer.id === layerId) return layer;
        if (layer.typename === "LayerSet") {
            var nested = ST_findLayerById(layer, layerId);
            if (nested) return nested;
        }
    }
    return null;
}

function ST_prepareLargeStarPixels(document, layer) {
    if (!layer || layer.typename !== "ArtLayer") {
        throw new Error("Star Boost (Large) 큰 별 강조에 사용할 픽셀 레이어가 없습니다.");
    }
    var shortEdge = Math.min(document.width.as("px"), document.height.as("px"));
    var sizeRadius = Math.max(1, Math.min(6, Math.round(shortEdge / 1400)));
    var softness = Math.max(0.6, Math.min(2.0, sizeRadius * 0.45));
    layer.applyMinimum(sizeRadius);
    layer.applyMaximum(sizeRadius);
    layer.adjustLevels(0, 160, 1.2, 0, 255);
    layer.applyGaussianBlur(softness);
}

function ST_createLargeStarBoost(documentId, starsLayerId, anchorLayerId, largeStarStrength) {
    var target = ST_findDocumentById(Number(documentId));
    if (!target) return "ERROR|Original Photoshop document is no longer open";
    var starsLayer = ST_findLayerById(target, Number(starsLayerId));
    if (!starsLayer || starsLayer.typename !== "ArtLayer") return "ERROR|Stars 레이어를 찾을 수 없습니다.";
    var anchor = null;
    if (anchorLayerId !== undefined && anchorLayerId !== null && String(anchorLayerId) !== "") {
        anchor = ST_findLayerById(target, Number(anchorLayerId));
        if (!anchor) return "ERROR|결과 레이어 배치 위치를 찾을 수 없습니다.";
    }
    var resultLayer = null;
    var originalDialogs = app.displayDialogs;
    try {
        app.displayDialogs = DialogModes.NO;
        app.activeDocument = target;
        resultLayer = starsLayer.duplicate();
        resultLayer.name = "Star Boost (Large)";
        ST_prepareLargeStarPixels(target, resultLayer);
        resultLayer.blendMode = BlendMode.SCREEN;
        resultLayer.visible = true;
        var highlightOpacity = Number(largeStarStrength);
        if (!isFinite(highlightOpacity)) highlightOpacity = 60;
        resultLayer.opacity = Math.max(10, Math.min(100, highlightOpacity));
        if (anchor) resultLayer.move(anchor, ElementPlacement.PLACEBEFORE);
        return "OK|" + resultLayer.id;
    } catch (error) {
        if (resultLayer) { try { resultLayer.remove(); } catch (removeError) {} }
        return "ERROR|" + error.message;
    } finally {
        app.displayDialogs = originalDialogs;
    }
}

function ST_importResult(filePath, documentId, layerName, anchorLayerId, profileMode, profileName, skyMaskToken, largeStarStrength) {
    var target = ST_findDocumentById(Number(documentId));
    if (!target) return "ERROR|Original Photoshop document is no longer open";
    var anchor = null;
    if (anchorLayerId !== undefined && anchorLayerId !== null && String(anchorLayerId) !== "") {
        anchor = ST_findLayerById(target, Number(anchorLayerId));
        if (!anchor) return "ERROR|처리한 원본 레이어를 찾을 수 없습니다.";
    }
    var resultFile = new File(filePath);
    if (!resultFile.exists) return "ERROR|Result file not found: " + filePath;
    var imported = null;
    var resultLayer = null;
    var originalDialogs = app.displayDialogs;
    try {
        app.displayDialogs = DialogModes.NO;
        imported = app.open(resultFile);
        if (profileMode === "NONE") {
            ST_assignDocumentProfile(imported, profileMode, "");
        } else if (profileMode && imported.mode === DocumentMode.RGB) {
            ST_assignDocumentProfile(imported, profileMode, profileName || "");
        }
        if (layerName === "Star Boost (Large)") ST_prepareLargeStarPixels(imported, imported.activeLayer);
        imported.activeLayer.duplicate(target, ElementPlacement.PLACEATBEGINNING);
        imported.close(SaveOptions.DONOTSAVECHANGES);
        imported = null;
        app.activeDocument = target;
        resultLayer = target.activeLayer;
        resultLayer.name = layerName || "StarNet2 result";
        resultLayer.blendMode = layerName === "Stars" || layerName === "Star Boost (Large)" ? BlendMode.SCREEN : BlendMode.NORMAL;
        if (layerName === "Star Boost (Large)") {
            resultLayer.visible = true;
            var highlightOpacity = Number(largeStarStrength);
            if (!isFinite(highlightOpacity)) highlightOpacity = 60;
            resultLayer.opacity = Math.max(10, Math.min(100, highlightOpacity));
        }
        if (anchor) resultLayer.move(anchor, ElementPlacement.PLACEBEFORE);
        if (skyMaskToken) ST_applySkyMask(target, resultLayer, skyMaskToken);
        return "OK|" + resultLayer.id;
    } catch (error) {
        if (imported) { try { imported.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {} }
        if (resultLayer) { try { resultLayer.remove(); } catch (removeError) {} }
        return "ERROR|" + error.message;
    } finally {
        app.displayDialogs = originalDialogs;
    }
}

function ST_removeResultLayers(documentId, layerIds) {
    var target = ST_findDocumentById(Number(documentId));
    if (!target) return "ERROR|Original Photoshop document is no longer open";
    var removed = 0;
    try {
        app.activeDocument = target;
        for (var index = 0; index < layerIds.length; index++) {
            var layer = ST_findLayerById(target, Number(layerIds[index]));
            if (layer) {
                layer.remove();
                removed++;
            }
        }
        return "OK|" + removed;
    } catch (error) {
        return "ERROR|" + error.message;
    }
}

function ST_abortRun(documentId, maskToken, layerIds) {
    var errors = [];
    var removeResult = ST_removeResultLayers(documentId, layerIds || []);
    if (removeResult.indexOf("ERROR|") === 0) errors.push(removeResult.substring(6));
    if (maskToken) {
        var maskResult = ST_finalizeSkyMask(documentId, maskToken);
        if (maskResult.indexOf("ERROR|") === 0) errors.push(maskResult.substring(6));
    }
    return errors.length ? "ERROR|" + errors.join("; ") : "OK";
}
