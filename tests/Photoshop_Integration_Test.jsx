#target photoshop

(function () {
    var projectDir = new Folder(typeof ST_TEST_PROJECT_PATH !== 'undefined'
        ? ST_TEST_PROJECT_PATH
        : new File($.fileName).parent.parent);
    var hostFile = new File(projectDir.fsName + '/StarNet-Panel/host/host.jsx');
    var reportFile = new File(projectDir.fsName + '/tests/Photoshop_Integration_Result.txt');
    var results = [];

    function test(name, callback) {
        try {
            callback();
            results.push('PASS | ' + name);
        } catch (error) {
            results.push('FAIL | ' + name + ' | ' + error.message);
        }
    }

    function assertTrue(value, message) {
        if (!value) throw new Error(message);
    }

    function removeFile(file) {
        try { if (file.exists) file.remove(); } catch (error) {}
    }

    try {
        assertTrue(hostFile.exists, 'host.jsx not found');
        $.evalFile(hostFile);

        test('document ID helper', function () {
            var document = app.documents.add(32, 32, 72, 'ST_TEST', NewDocumentMode.RGB, DocumentFill.WHITE);
            try {
                assertTrue(ST_documentId(document) === document.id, 'document ID mismatch');
                assertTrue(ST_findDocumentById(document.id) === document, 'document lookup failed');
            } finally {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('active document and layer preflight info', function () {
            var document = app.documents.add(32, 32, 72, 'ST 정보', NewDocumentMode.RGB, DocumentFill.WHITE);
            try {
                var pixelInfo = ST_getActiveDocumentInfo().split('|');
                assertTrue(pixelInfo[0] === 'OK', 'document preflight failed');
                assertTrue(decodeURIComponent(pixelInfo[1]) === 'ST 정보', 'encoded document name mismatch');
                assertTrue(pixelInfo[5] === '1' && pixelInfo[6] === 'FULL', 'full-frame pixel layer was not reported ready');
                assertTrue(pixelInfo[7] === '0' && pixelInfo[8] === '0', 'empty sky-region state was not reported');
                assertTrue(Number(pixelInfo[9]) === document.id && Number(pixelInfo[10]) === document.activeLayer.id,
                    'document or layer ID was not reported');

                document.selection.select([[0, 0], [16, 0], [16, 32], [0, 32]]);
                var selectionInfo = ST_getActiveDocumentInfo().split('|');
                assertTrue(selectionInfo[7] === '1', 'selection was not reported for sky mode');
                document.selection.deselect();

                var textLayer = document.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                var textInfo = ST_getActiveDocumentInfo().split('|');
                assertTrue(textInfo[5] === '0' && textInfo[6] === 'UNSUPPORTED', 'unsupported layer was reported ready');
            } finally {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('pixel layer validation', function () {
            var document = app.documents.add(32, 32, 72, 'ST_TEST', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            try {
                assertTrue(ST_isPixelLayer(document.activeLayer), 'normal pixel layer was rejected');
                assertTrue(!ST_layerCoversDocument(document, document.activeLayer), 'empty layer was reported as full frame');
                var textLayer = document.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                assertTrue(!ST_isPixelLayer(textLayer), 'text layer was accepted');
            } finally {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('nested layer lookup', function () {
            var document = app.documents.add(32, 32, 72, 'ST_TEST', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            try {
                var group = document.layerSets.add();
                var nestedLayer = group.artLayers.add();
                assertTrue(ST_findLayerById(document, nestedLayer.id) === nestedLayer, 'nested layer lookup failed');
            } finally {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('ICC profile assignment', function () {
            var document = app.documents.add(32, 32, 72, 'ST_PROFILE', NewDocumentMode.RGB, DocumentFill.WHITE);
            try {
                ST_assignDocumentProfile(document, 'TAGGED', 'Adobe RGB (1998)');
                assertTrue(document.colorProfileName === 'Adobe RGB (1998)', 'profile name was not assigned');
                ST_assignDocumentProfile(document, 'NONE', '');
                assertTrue(document.colorProfileType === ColorProfile.NONE, 'profile was not removed');
                ST_assignDocumentProfile(document, 'TAGGED', 'Adobe RGB (1998)');
                assertTrue(document.colorProfileName === 'Adobe RGB (1998)', 'profile was not restored from untagged state');
            } finally {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('composite and active layer input export', function () {
            var document = app.documents.add(32, 32, 72, 'ST_TEST', NewDocumentMode.RGB, DocumentFill.WHITE);
            var compositeFile = new File(Folder.temp.fsName + '/starnet2_test_composite.tif');
            var layerFile = new File(Folder.temp.fsName + '/starnet2_test_layer.tif');
            removeFile(compositeFile);
            removeFile(layerFile);
            try {
                var compositeResult = ST_prepareInput(compositeFile.fsName, 'composite');
                assertTrue(compositeResult.indexOf('OK|' + document.id + '|') === 0, 'composite export failed: ' + compositeResult);
                assertTrue(compositeFile.exists, 'composite TIFF was not created');

                app.activeDocument = document;
                var layerId = document.activeLayer.id;
                assertTrue(ST_layerCoversDocument(document, document.activeLayer), 'background layer was not reported as full frame');
                var layerResult = ST_prepareInput(layerFile.fsName, 'layer');
                var layerParts = layerResult.split('|');
                assertTrue(layerParts[0] === 'OK' && Number(layerParts[1]) === document.id, 'layer export failed: ' + layerResult);
                assertTrue(Number(layerParts[2]) === layerId && layerParts[3] === 'FULL', 'layer export metadata mismatch');
                assertTrue(layerParts[4] === 'TAGGED', 'layer export profile was not recorded');
                assertTrue(decodeURIComponent(layerParts[5]) === document.colorProfileName, 'layer export profile name mismatch');
                assertTrue(layerFile.exists, 'layer TIFF was not created');
                var reopenedInput = app.open(layerFile);
                try {
                    assertTrue(reopenedInput.colorProfileName === document.colorProfileName, 'input TIFF profile was not embedded');
                } finally {
                    reopenedInput.close(SaveOptions.DONOTSAVECHANGES);
                    app.activeDocument = document;
                }
            } finally {
                removeFile(compositeFile);
                removeFile(layerFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('stretch preview closes its temporary document', function () {
            var document = app.documents.add(48, 32, 72, 'ST_STRETCH_PREVIEW', NewDocumentMode.RGB, DocumentFill.WHITE);
            var previewFile = new File(Folder.temp.fsName + '/starnet2_test_stretch_preview.jpg');
            removeFile(previewFile);
            try {
                var documentCount = app.documents.length;
                var preview = ST_prepareStretchPreview(previewFile.fsName, 24, 24).split('|');
                assertTrue(preview[0] === 'OK', 'stretch preview failed: ' + preview.join('|'));
                assertTrue(previewFile.exists, 'stretch preview JPEG was not created');
                assertTrue(app.documents.length === documentCount, 'stretch preview temporary document remained open');
                assertTrue(app.activeDocument === document, 'source document was not restored after stretch preview');
                assertTrue(Number(preview[1]) === document.id && Number(preview[2]) === document.activeLayer.id,
                    'stretch preview source metadata mismatch');
            } finally {
                removeFile(previewFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('stretch input remains locked to the preview document and layer', function () {
            var document = app.documents.add(32, 32, 72, 'ST_STRETCH_TARGET', NewDocumentMode.RGB, DocumentFill.WHITE);
            var stretchFile = new File(Folder.temp.fsName + '/starnet2_test_stretch_target.tif');
            removeFile(stretchFile);
            try {
                var layerId = document.activeLayer.id;
                var wrongDocument = ST_prepareInput(stretchFile.fsName, 'layer', document.id + 100000, layerId);
                assertTrue(wrongDocument.indexOf('ERROR|') === 0, 'changed document was accepted');
                assertTrue(!stretchFile.exists, 'changed-document input TIFF was created');
                var wrongLayer = ST_prepareInput(stretchFile.fsName, 'layer', document.id, layerId + 100000);
                assertTrue(wrongLayer.indexOf('ERROR|') === 0, 'changed layer was accepted');
                assertTrue(!stretchFile.exists, 'changed-layer input TIFF was created');
                var valid = ST_prepareInput(stretchFile.fsName, 'layer', document.id, layerId);
                assertTrue(valid.indexOf('OK|') === 0 && stretchFile.exists, 'locked Stretch target was rejected');
            } finally {
                removeFile(stretchFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('stretch automatically uses the selection as the result mask', function () {
            var document = app.documents.add(32, 32, 72, 'ST_STRETCH_REGION', NewDocumentMode.RGB, DocumentFill.WHITE);
            var stretchFile = new File(Folder.temp.fsName + '/starnet2_test_stretch_region.tif');
            removeFile(stretchFile);
            try {
                var sourceLayer = document.activeLayer;
                var sourceLayerId = sourceLayer.id;
                document.selection.select([[0, 0], [16, 0], [16, 32], [0, 32]]);
                var prepared = ST_prepareInput(stretchFile.fsName, 'layer-auto').split('|');
                assertTrue(prepared[0] === 'OK', 'automatic Stretch export failed: ' + prepared.join('|'));
                assertTrue(Number(prepared[2]) === sourceLayerId, 'stretch source layer anchor was not retained');
                var maskToken = decodeURIComponent(prepared[6]);
                assertTrue(maskToken.indexOf('S:') === 0, 'stretch selection token was not created');

                var imported = ST_importResult(stretchFile.fsName, document.id, 'Stretched test', sourceLayerId,
                    prepared[4], decodeURIComponent(prepared[5]), maskToken, 100).split('|');
                assertTrue(imported[0] === 'OK', 'stretch result import failed: ' + imported.join('|'));
                var resultLayer = ST_findLayerById(document, Number(imported[1]));
                assertTrue(resultLayer !== null, 'stretch result layer was not created');
                assertTrue(resultLayer.parent === sourceLayer.parent, 'stretch result was not placed with the source layer');
                assertTrue(ST_activeLayerHasMask(document), 'stretch result has no region mask');

                var finalized = ST_finalizeSkyMask(document.id, maskToken);
                assertTrue(finalized === 'OK', 'stretch region cleanup failed: ' + finalized);
                assertTrue(ST_hasSelection(document), 'stretch source selection was not restored');
                resultLayer.remove();
            } finally {
                removeFile(stretchFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('stretch copies an existing layer mask without baking it into the input', function () {
            var document = app.documents.add(32, 32, 72, 'ST_STRETCH_LAYER_MASK', NewDocumentMode.RGB, DocumentFill.WHITE);
            var stretchFile = new File(Folder.temp.fsName + '/starnet2_test_stretch_layer_mask.tif');
            var verification = null;
            var stage = 'fixture';
            removeFile(stretchFile);
            try {
                var sourceLayer = document.activeLayer;
                stage = 'create source mask';
                document.selection.select([[0, 0], [32, 0], [32, 16], [0, 16]]);
                ST_addRevealSelectionMask();
                document.selection.deselect();

                stage = 'create verification document';
                verification = document.duplicate('ST_MASK_DISCARD_CHECK', false);
                app.activeDocument = verification;
                stage = 'remove duplicated mask';
                ST_removeActiveLayerMaskWithoutApplying(verification);
                stage = 'verify duplicated mask';
                assertTrue(!ST_activeLayerHasMask(verification), 'mask remained on the Stretch input layer');
                assertTrue(ST_layerCoversDocument(verification, verification.activeLayer),
                    'hidden source pixels were discarded with the input mask');
                stage = 'close verification document';
                verification.close(SaveOptions.DONOTSAVECHANGES);
                verification = null;
                app.activeDocument = document;

                stage = 'prepare automatic input';
                var prepared = ST_prepareInput(stretchFile.fsName, 'layer-auto').split('|');
                assertTrue(prepared[0] === 'OK', 'automatic layer-mask Stretch export failed: ' + prepared.join('|'));
                var maskToken = decodeURIComponent(prepared[6]);
                assertTrue(maskToken.indexOf('M:') === 0, 'existing layer mask token was not created');

                stage = 'import automatic result';
                var imported = ST_importResult(stretchFile.fsName, document.id, 'Stretched mask test', Number(prepared[2]),
                    prepared[4], decodeURIComponent(prepared[5]), maskToken, 100).split('|');
                assertTrue(imported[0] === 'OK', 'masked Stretch result import failed: ' + imported.join('|'));
                stage = 'verify imported mask';
                assertTrue(ST_activeLayerHasMask(document), 'existing layer mask was not copied to the Stretch result');
                stage = 'remove imported result';
                ST_findLayerById(document, Number(imported[1])).remove();

                stage = 'finalize automatic mask';
                var finalized = ST_finalizeSkyMask(document.id, maskToken);
                assertTrue(finalized === 'OK', 'automatic layer-mask cleanup failed: ' + finalized);
                assertTrue(!ST_hasSelection(document), 'selection remained after automatic layer-mask mode');
            } catch (error) {
                throw new Error(stage + ': ' + error.message);
            } finally {
                if (verification) { try { verification.close(SaveOptions.DONOTSAVECHANGES); } catch (verificationCloseError) {} }
                removeFile(stretchFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('result order, blend mode, visibility, and rollback', function () {
            var document = app.documents.add(32, 32, 72, 'ST_TEST', NewDocumentMode.RGB, DocumentFill.WHITE);
            var resultFile = new File(Folder.temp.fsName + '/starnet2_test_result.tif');
            removeFile(resultFile);
            try {
                var anchorId = document.activeLayer.id;
                var exportResult = ST_prepareInput(resultFile.fsName, 'composite');
                assertTrue(exportResult.indexOf('OK|' + document.id + '|') === 0, 'result fixture export failed');
                app.activeDocument = document;
                var profileName = document.colorProfileName;
                var starlessResult = ST_importResult(resultFile.fsName, document.id, 'Starless', anchorId, 'TAGGED', profileName).split('|');
                assertTrue(starlessResult[0] === 'OK', 'Starless import failed');
                var starlessId = Number(starlessResult[1]);
                var starsResult = ST_importResult(resultFile.fsName, document.id, 'Stars', starlessId, 'TAGGED', profileName).split('|');
                assertTrue(starsResult[0] === 'OK', 'Stars import failed');
                var starsId = Number(starsResult[1]);
                var boostResult = ST_createLargeStarBoost(document.id, starsId, starsId, 60).split('|');
                assertTrue(boostResult[0] === 'OK', 'Star Boost (Large) creation from Stars failed');
                var boostId = Number(boostResult[1]);

                assertTrue(document.layers[0].name === 'Star Boost (Large)', 'Star Boost (Large) is not the top result layer');
                assertTrue(document.layers[1].name === 'Stars', 'Stars is not below Star Boost (Large)');
                assertTrue(document.layers[2].name === 'Starless', 'Starless is not below Stars');
                assertTrue(document.layers[1].blendMode === BlendMode.SCREEN, 'Stars blend mode is not Screen');
                assertTrue(document.layers[2].blendMode === BlendMode.NORMAL, 'Starless blend mode is not Normal');
                assertTrue(document.layers[0].visible === true, 'Star Boost (Large) should be visible for large-star emphasis');
                assertTrue(document.layers[0].blendMode === BlendMode.SCREEN, 'Star Boost (Large) blend mode is not Screen');
                assertTrue(Math.round(document.layers[0].opacity) === 60, 'Star Boost (Large) default opacity is not 60%');

                var resultLayerIds = [starlessId, starsId, boostId];
                var rollbackResult = ST_removeResultLayers(document.id, resultLayerIds);
                assertTrue(rollbackResult === 'OK|3', 'result rollback failed: ' + rollbackResult);
                for (var index = 0; index < resultLayerIds.length; index++) {
                    assertTrue(ST_findLayerById(document, resultLayerIds[index]) === null, 'result layer remained after rollback');
                }

                var boostOnly = ST_importResult(resultFile.fsName, document.id, 'Star Boost (Large)', anchorId, 'TAGGED', profileName, '', 60).split('|');
                assertTrue(boostOnly[0] === 'OK', 'standalone Star Boost (Large) import failed: ' + boostOnly.join('|'));
                var boostOnlyLayer = ST_findLayerById(document, Number(boostOnly[1]));
                assertTrue(boostOnlyLayer !== null, 'standalone Star Boost (Large) layer was not created');
                assertTrue(boostOnlyLayer.blendMode === BlendMode.SCREEN, 'standalone Star Boost (Large) is not Screen');
                assertTrue(Math.round(boostOnlyLayer.opacity) === 60, 'standalone Star Boost (Large) opacity is not 60%');
                boostOnlyLayer.remove();
            } finally {
                removeFile(resultFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('sky mode rejects a missing selection or layer mask', function () {
            var document = app.documents.add(32, 32, 72, 'ST_SKY_MISSING', NewDocumentMode.RGB, DocumentFill.WHITE);
            var skyFile = new File(Folder.temp.fsName + '/starnet2_test_sky_missing.tif');
            removeFile(skyFile);
            try {
                var originalChannelCount = document.channels.length;
                var result = ST_prepareInput(skyFile.fsName, 'sky');
                assertTrue(result.indexOf('ERROR|') === 0, 'sky mode started without a region: ' + result);
                assertTrue(result.indexOf('선택 영역') >= 0, 'missing sky-region guidance was not returned');
                assertTrue(document.channels.length === originalChannelCount, 'temporary channel remained after failure');
                assertTrue(!skyFile.exists, 'TIFF remained after failed sky preparation');
            } finally {
                removeFile(skyFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('current layer inside a group keeps result placement', function () {
            var document = app.documents.add(32, 32, 72, 'ST_GROUP_LAYER', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            var groupFile = new File(Folder.temp.fsName + '/starnet2_test_group_layer.tif');
            removeFile(groupFile);
            try {
                var group = document.layerSets.add();
                group.name = 'Source Group';
                var sourceLayer = group.artLayers.add();
                sourceLayer.name = 'Nested Source';
                document.activeLayer = sourceLayer;
                var white = new SolidColor();
                white.rgb.red = 255;
                white.rgb.green = 255;
                white.rgb.blue = 255;
                document.selection.selectAll();
                document.selection.fill(white);
                document.selection.deselect();

                var prepared = ST_prepareInput(groupFile.fsName, 'layer').split('|');
                assertTrue(prepared[0] === 'OK', 'nested current-layer export failed: ' + prepared.join('|'));
                assertTrue(Number(prepared[2]) === sourceLayer.id, 'nested source anchor ID was not retained');
                var imported = ST_importResult(groupFile.fsName, document.id, 'Starless', sourceLayer.id, 'TAGGED', document.colorProfileName).split('|');
                assertTrue(imported[0] === 'OK', 'nested current-layer result import failed: ' + imported.join('|'));
                var resultLayer = ST_findLayerById(document, Number(imported[1]));
                assertTrue(resultLayer !== null, 'nested current-layer result was not created');
                assertTrue(resultLayer.parent === group, 'nested current-layer result was not placed in the source group');
                resultLayer.remove();
            } finally {
                removeFile(groupFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('Star Removal automatically applies the selection to every result', function () {
            var document = app.documents.add(32, 32, 72, 'ST_SKY_SELECTION', NewDocumentMode.RGB, DocumentFill.WHITE);
            var skyFile = new File(Folder.temp.fsName + '/starnet2_test_sky_selection.tif');
            removeFile(skyFile);
            try {
                document.selection.select([[0, 0], [16, 0], [16, 32], [0, 32]]);
                var prepared = ST_prepareInput(skyFile.fsName, 'layer-auto').split('|');
                assertTrue(prepared[0] === 'OK', 'automatic selection export failed: ' + prepared.join('|'));
                var maskToken = decodeURIComponent(prepared[6]);
                assertTrue(maskToken.indexOf('S:') === 0, 'selection token was not created');

                var anchorId = Number(prepared[2]);
                var profileName = document.colorProfileName;
                var first = ST_importResult(skyFile.fsName, document.id, 'Starless', anchorId, 'TAGGED', profileName, maskToken).split('|');
                assertTrue(first[0] === 'OK', 'first sky result import failed: ' + first.join('|'));
                var second = ST_importResult(skyFile.fsName, document.id, 'Stars', Number(first[1]), 'TAGGED', profileName, maskToken).split('|');
                assertTrue(second[0] === 'OK', 'second sky result import failed: ' + second.join('|'));
                assertTrue(ST_activeLayerHasMask(document), 'second sky result has no layer mask');
                var boost = ST_createLargeStarBoost(document.id, Number(second[1]), Number(second[1]), 60).split('|');
                assertTrue(boost[0] === 'OK', 'sky Star Boost (Large) creation failed: ' + boost.join('|'));
                assertTrue(ST_activeLayerHasMask(document), 'sky Star Boost (Large) did not retain the region mask');
                document.activeLayer = ST_findLayerById(document, Number(first[1]));
                assertTrue(ST_activeLayerHasMask(document), 'first sky result has no layer mask');

                var finalized = ST_finalizeSkyMask(document.id, maskToken);
                assertTrue(finalized === 'OK', 'sky selection cleanup failed: ' + finalized);
                assertTrue(ST_hasSelection(document), 'original selection was not restored');
                assertTrue(!ST_findChannel(document, ST_skyMaskTokenParts(maskToken).channelName), 'temporary selection channel remained');
            } finally {
                removeFile(skyFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('Star Removal automatically copies the active layer mask', function () {
            var document = app.documents.add(32, 32, 72, 'ST_SKY_LAYER_MASK', NewDocumentMode.RGB, DocumentFill.WHITE);
            var skyFile = new File(Folder.temp.fsName + '/starnet2_test_sky_layer_mask.tif');
            removeFile(skyFile);
            try {
                document.selection.select([[0, 0], [32, 0], [32, 16], [0, 16]]);
                ST_addRevealSelectionMask();
                document.selection.deselect();
                assertTrue(ST_activeLayerHasMask(document), 'source layer mask was not created');

                var prepared = ST_prepareInput(skyFile.fsName, 'layer-auto').split('|');
                assertTrue(prepared[0] === 'OK', 'automatic layer-mask export failed: ' + prepared.join('|'));
                var maskToken = decodeURIComponent(prepared[6]);
                assertTrue(maskToken.indexOf('M:') === 0, 'layer-mask token was not created');
                var imported = ST_importResult(skyFile.fsName, document.id, 'Starless', '', 'TAGGED', document.colorProfileName, maskToken).split('|');
                assertTrue(imported[0] === 'OK', 'layer-mask sky result import failed: ' + imported.join('|'));
                assertTrue(ST_activeLayerHasMask(document), 'imported sky result has no layer mask');

                var finalized = ST_finalizeSkyMask(document.id, maskToken);
                assertTrue(finalized === 'OK', 'layer-mask sky cleanup failed: ' + finalized);
                assertTrue(!ST_hasSelection(document), 'selection remained after layer-mask sky mode');
                assertTrue(!ST_findChannel(document, ST_skyMaskTokenParts(maskToken).channelName), 'temporary layer-mask channel remained');
            } finally {
                removeFile(skyFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });

        test('aborted run removes result layers and temporary region data', function () {
            var document = app.documents.add(32, 32, 72, 'ST_ABORT_RUN', NewDocumentMode.RGB, DocumentFill.WHITE);
            var abortFile = new File(Folder.temp.fsName + '/starnet2_test_abort_run.tif');
            removeFile(abortFile);
            try {
                document.selection.select([[0, 0], [16, 0], [16, 32], [0, 32]]);
                var prepared = ST_prepareInput(abortFile.fsName, 'sky').split('|');
                assertTrue(prepared[0] === 'OK', 'abort fixture preparation failed: ' + prepared.join('|'));
                var maskToken = decodeURIComponent(prepared[6]);
                var imported = ST_importResult(abortFile.fsName, document.id, 'Starless', document.activeLayer.id, 'TAGGED', document.colorProfileName, maskToken).split('|');
                assertTrue(imported[0] === 'OK', 'abort fixture result import failed: ' + imported.join('|'));
                var importedId = Number(imported[1]);
                assertTrue(ST_findLayerById(document, importedId) !== null, 'abort fixture result layer was not created');

                var aborted = ST_abortRun(document.id, maskToken, [importedId]);
                assertTrue(aborted === 'OK', 'run abort cleanup failed: ' + aborted);
                assertTrue(ST_findLayerById(document, importedId) === null, 'aborted result layer remained');
                assertTrue(ST_hasSelection(document), 'selection was not restored after run abort');
                assertTrue(!ST_findChannel(document, ST_skyMaskTokenParts(maskToken).channelName), 'temporary region channel remained after run abort');
            } finally {
                removeFile(abortFile);
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        });
    } catch (error) {
        results.push('FAIL | initialization | ' + error.message);
    }

    var failures = 0;
    for (var index = 0; index < results.length; index++) {
        if (results[index].indexOf('FAIL |') === 0) failures++;
    }
    reportFile.encoding = 'UTF-8';
    reportFile.open('w');
    reportFile.write(
        'StarNet Photoshop integration test\n' +
        'Result: ' + (failures ? 'FAIL' : 'PASS') + '\n' +
        'Passed: ' + (results.length - failures) + '\n' +
        'Failed: ' + failures + '\n\n' +
        results.join('\n')
    );
    reportFile.close();
}());
