"use strict";
/// <reference types="@figma/plugin-typings" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// This plugin helps designers create component migration mappings for design system updates
// Show the UI
figma.showUI(__html__, {
    width: 380,
    height: 520,
    title: "Component Migration Helper"
});
// Function to get library name from component key
function getLibraryNameFromKey(componentKey) {
    try {
        const fileKey = componentKey.split(':')[0];
        // For now, return the full file key as the library identifier
        // This will show the actual library key without truncation
        return fileKey;
    }
    catch (error) {
        console.log('Could not get library name for key:', componentKey, error);
        return 'Unknown Library';
    }
}
// Initialize by loading saved mappings
loadSavedMappings();
// Listen for selection changes
figma.on("selectionchange", () => {
    handleSelectionChange();
});
// Initial selection check - with a small delay to ensure UI is ready
setTimeout(() => {
    handleSelectionChange();
}, 100);
// Handle messages from the UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    switch (msg.type) {
        case 'copySelectedKey':
            yield copySelectedComponentKey();
            break;
        case 'generateVisuals':
            yield generateVisualComparison(msg.mappings);
            break;
        case 'saveMappings':
            yield saveMappings(msg.data);
            clearSelection();
            break;
        case 'loadMappings':
            yield loadSavedMappings();
            break;
        case 'getInitialSelection':
            handleSelectionChange();
            break;
        case 'insertComponentsByKeys':
            yield insertComponentsByKeys(msg.keys);
            break;
    }
});
// Ensure component key is properly formatted for import
function formatComponentKey(key) {
    // If already properly formatted (contains colons), return as-is
    if (key.includes(':')) {
        return key;
    }
    // If it's just a node ID, we need to add the file key
    const fileKey = figma.fileKey;
    if (fileKey) {
        return `${fileKey}:${key}`;
    }
    return key;
}
// Handle selection changes
function handleSelectionChange() {
    const selection = figma.currentPage.selection;
    const componentInfo = [];
    for (const node of selection) {
        const componentKey = getComponentKey(node);
        if (componentKey) {
            componentInfo.push({
                key: componentKey,
                name: getComponentName(node),
                id: node.id,
                library: getLibraryNameFromKey(componentKey)
            });
        }
    }
    figma.ui.postMessage({
        type: 'selectionChange',
        selection: componentInfo
    });
}
// Get component key from a node
function getComponentKey(node) {
    var _a, _b;
    if (node.type === 'COMPONENT') {
        // Get the full component key including file key
        return node.key;
    }
    else if (node.type === 'INSTANCE') {
        // Use the new async method to avoid deprecation warning
        const mainComponentId = (_a = node.mainComponent) === null || _a === void 0 ? void 0 : _a.id;
        if (mainComponentId) {
            // For now, return the component key if available
            return ((_b = node.mainComponent) === null || _b === void 0 ? void 0 : _b.key) || null;
        }
    }
    return null;
}
function clearSelection() {
    figma.currentPage.selection = [];
}
// Insert components by their keys
function insertComponentsByKeys(keys) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const insertedComponents = [];
            const errors = [];
            // Get cursor position or use viewport center
            const viewportCenter = figma.viewport.center;
            let currentX = viewportCenter.x;
            let currentY = viewportCenter.y;
            for (const key of keys) {
                try {
                    // Format the component key
                    const formattedKey = formatComponentKey(key);
                    // Import the component
                    const component = yield figma.importComponentByKeyAsync(formattedKey);
                    if (component) {
                        // Create instance
                        const instance = component.createInstance();
                        // Position the instance
                        instance.x = currentX;
                        instance.y = currentY;
                        // Add to inserted components
                        insertedComponents.push(instance);
                        // Move position for next component (stack horizontally)
                        currentX += instance.width + 20;
                        // If we've gone too far right, move to next row
                        if (currentX > viewportCenter.x + 400) {
                            currentX = viewportCenter.x;
                            currentY += instance.height + 20;
                        }
                    }
                    else {
                        errors.push(`Could not import component with key: ${key}`);
                    }
                }
                catch (error) {
                    console.error('Error importing component:', key, error);
                    errors.push(`Invalid component key: ${key}`);
                }
            }
            // Select all inserted components
            if (insertedComponents.length > 0) {
                figma.currentPage.selection = insertedComponents;
                figma.viewport.scrollAndZoomIntoView(insertedComponents);
            }
            // Send result back to UI
            figma.ui.postMessage({
                type: 'componentInsertionResult',
                success: insertedComponents.length > 0,
                insertedCount: insertedComponents.length,
                errorCount: errors.length,
                errors: errors
            });
        }
        catch (error) {
            console.error('Error in insertComponentsByKeys:', error);
            figma.ui.postMessage({
                type: 'componentInsertionResult',
                success: false,
                insertedCount: 0,
                errorCount: 1,
                errors: ['Failed to insert components']
            });
        }
    });
}
// Get a readable component name
function getComponentName(node) {
    var _a, _b, _c;
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        let name = node.name;
        // If it's an instance, try to get the main component name
        if (node.type === 'INSTANCE' && node.mainComponent) {
            name = node.mainComponent.name;
        }
        // Extract base name from variant syntax (e.g., "Button/Primary" from complex variant names)
        // First, check if it's a variant with properties
        if (name.includes('=')) {
            // This is a variant, try to get the parent component set name
            // Sometimes Figma includes the component set name at the beginning
            if (node.type === 'INSTANCE' && ((_b = (_a = node.mainComponent) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.type) === 'COMPONENT_SET') {
                name = node.mainComponent.parent.name;
            }
            else if (node.type === 'COMPONENT' && ((_c = node.parent) === null || _c === void 0 ? void 0 : _c.type) === 'COMPONENT_SET') {
                name = node.parent.name;
            }
        }
        // Store variant properties separately for tooltip
        let variantProps = '';
        if ('variantProperties' in node && node.variantProperties) {
            const props = Object.keys(node.variantProperties)
                .map((key) => `${key}=${node.variantProperties[key]}`)
                .join(', ');
            if (props) {
                variantProps = props;
            }
        }
        // Return clean name with variant properties as metadata
        return variantProps ? `${name}|${variantProps}` : name;
    }
    return node.name;
}
// Copy selected component key to clipboard
function copySelectedComponentKey() {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.ui.postMessage({
                type: 'keyCopied',
                success: false,
                error: 'No component selected'
            });
            return;
        }
        const componentKey = getComponentKey(selection[0]);
        if (!componentKey) {
            figma.ui.postMessage({
                type: 'keyCopied',
                success: false,
                error: 'Selected node is not a component'
            });
            return;
        }
        figma.ui.postMessage({
            type: 'keyCopied',
            success: true,
            key: componentKey
        });
    });
}
// Generate visual comparison frames
function generateVisualComparison(mappings) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Load the Inter font FIRST, before creating any text nodes
            yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
            yield figma.loadFontAsync({ family: "Inter", style: "Medium" });
            yield figma.loadFontAsync({ family: "Inter", style: "Bold" });
            // Create a new frame for the comparison
            const frame = figma.createFrame();
            frame.name = "Component Migration Visual";
            frame.layoutMode = "VERTICAL";
            frame.layoutAlign = "STRETCH";
            frame.itemSpacing = 24;
            frame.paddingLeft = 40;
            frame.paddingRight = 40;
            frame.paddingTop = 40;
            frame.paddingBottom = 40;
            frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
            frame.primaryAxisSizingMode = "AUTO";
            frame.counterAxisSizingMode = "AUTO";
            // Position the frame in view
            frame.x = figma.viewport.center.x - 400;
            frame.y = figma.viewport.center.y - 300;
            let hasErrors = false;
            for (const mapping of mappings) {
                try {
                    // Create container for this mapping pair (horizontal layout)
                    const pairFrame = figma.createFrame();
                    pairFrame.name = `${mapping.oldName || 'Old'} → ${mapping.newName || 'New'}`;
                    pairFrame.layoutMode = "HORIZONTAL";
                    pairFrame.layoutAlign = "STRETCH";
                    pairFrame.itemSpacing = 32;
                    pairFrame.paddingLeft = 24;
                    pairFrame.paddingRight = 24;
                    pairFrame.paddingTop = 24;
                    pairFrame.paddingBottom = 24;
                    pairFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
                    pairFrame.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
                    pairFrame.strokeWeight = 1;
                    pairFrame.cornerRadius = 8;
                    pairFrame.primaryAxisSizingMode = "AUTO";
                    pairFrame.counterAxisSizingMode = "AUTO";
                    // OLD component section
                    const oldSection = figma.createFrame();
                    oldSection.name = "OLD";
                    oldSection.layoutMode = "VERTICAL";
                    oldSection.layoutAlign = "STRETCH";
                    oldSection.itemSpacing = 12;
                    oldSection.primaryAxisSizingMode = "AUTO";
                    oldSection.counterAxisSizingMode = "AUTO";
                    // OLD label (RED)
                    const oldLabel = figma.createText();
                    oldLabel.characters = "OLD";
                    oldLabel.fontSize = 12;
                    oldLabel.fontName = { family: "Inter", style: "Bold" };
                    oldLabel.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }]; // Red color
                    oldSection.appendChild(oldLabel);
                    // OLD component title and key
                    const oldTitleFrame = figma.createFrame();
                    oldTitleFrame.layoutMode = "VERTICAL";
                    oldTitleFrame.layoutAlign = "STRETCH";
                    oldTitleFrame.itemSpacing = 4;
                    oldTitleFrame.primaryAxisSizingMode = "AUTO";
                    oldTitleFrame.counterAxisSizingMode = "AUTO";
                    // Component name
                    const oldName = figma.createText();
                    const oldParts = (mapping.oldName || 'Component').split('|');
                    const oldCleanName = oldParts[0];
                    oldName.characters = oldCleanName;
                    oldName.fontSize = 16;
                    oldName.fontName = { family: "Inter", style: "Medium" };
                    oldName.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
                    oldTitleFrame.appendChild(oldName);
                    // Component key
                    const oldKeyText = figma.createText();
                    const oldLibraryName = getLibraryNameFromKey(mapping.oldKey);
                    oldKeyText.characters = `(${oldLibraryName})`;
                    oldKeyText.fontSize = 12;
                    oldKeyText.fontName = { family: "Inter", style: "Regular" };
                    oldKeyText.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
                    oldTitleFrame.appendChild(oldKeyText);
                    // Variant properties (if any)
                    if (oldParts[1]) {
                        const oldVariantText = figma.createText();
                        oldVariantText.characters = oldParts[1];
                        oldVariantText.fontSize = 11;
                        oldVariantText.fontName = { family: "Inter", style: "Regular" };
                        oldVariantText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
                        oldTitleFrame.appendChild(oldVariantText);
                    }
                    oldSection.appendChild(oldTitleFrame);
                    // Try to create instance of OLD component
                    try {
                        const formattedKey = formatComponentKey(mapping.oldKey);
                        const oldComponent = yield figma.importComponentByKeyAsync(formattedKey);
                        if (oldComponent) {
                            const oldInstance = oldComponent.createInstance();
                            oldSection.appendChild(oldInstance);
                        }
                    }
                    catch (err) {
                        const errorText = figma.createText();
                        errorText.characters = "⚠️ Component not found";
                        errorText.fontSize = 12;
                        errorText.fontName = { family: "Inter", style: "Regular" };
                        errorText.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }];
                        oldSection.appendChild(errorText);
                    }
                    pairFrame.appendChild(oldSection);
                    // Arrow container
                    const arrowContainer = figma.createFrame();
                    arrowContainer.layoutMode = "VERTICAL";
                    arrowContainer.layoutAlign = "CENTER";
                    arrowContainer.primaryAxisAlignItems = "CENTER";
                    arrowContainer.counterAxisAlignItems = "CENTER";
                    arrowContainer.primaryAxisSizingMode = "AUTO";
                    arrowContainer.counterAxisSizingMode = "AUTO";
                    const arrowText = figma.createText();
                    arrowText.characters = "→";
                    arrowText.fontSize = 24;
                    arrowText.fontName = { family: "Inter", style: "Regular" };
                    arrowText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
                    arrowContainer.appendChild(arrowText);
                    pairFrame.appendChild(arrowContainer);
                    // NEW component section
                    const newSection = figma.createFrame();
                    newSection.name = "NEW";
                    newSection.layoutMode = "VERTICAL";
                    newSection.layoutAlign = "STRETCH";
                    newSection.itemSpacing = 12;
                    newSection.primaryAxisSizingMode = "AUTO";
                    newSection.counterAxisSizingMode = "AUTO";
                    // NEW label (GREEN)
                    const newLabel = figma.createText();
                    newLabel.characters = "NEW";
                    newLabel.fontSize = 12;
                    newLabel.fontName = { family: "Inter", style: "Bold" };
                    newLabel.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 0.2 } }];
                    newSection.appendChild(newLabel);
                    // NEW component title and key
                    const newTitleFrame = figma.createFrame();
                    newTitleFrame.layoutMode = "VERTICAL";
                    newTitleFrame.layoutAlign = "STRETCH";
                    newTitleFrame.itemSpacing = 4;
                    newTitleFrame.primaryAxisSizingMode = "AUTO";
                    newTitleFrame.counterAxisSizingMode = "AUTO";
                    // Component name
                    const newName = figma.createText();
                    const newParts = (mapping.newName || 'Component').split('|');
                    const newCleanName = newParts[0];
                    newName.characters = newCleanName;
                    newName.fontSize = 16;
                    newName.fontName = { family: "Inter", style: "Medium" };
                    newName.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
                    newTitleFrame.appendChild(newName);
                    // Component key
                    const newKeyText = figma.createText();
                    const newLibraryName = getLibraryNameFromKey(mapping.newKey);
                    newKeyText.characters = `(${newLibraryName})`;
                    newKeyText.fontSize = 12;
                    newKeyText.fontName = { family: "Inter", style: "Regular" };
                    newKeyText.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
                    newTitleFrame.appendChild(newKeyText);
                    // Variant properties (if any)
                    if (newParts[1]) {
                        const newVariantText = figma.createText();
                        newVariantText.characters = newParts[1];
                        newVariantText.fontSize = 11;
                        newVariantText.fontName = { family: "Inter", style: "Regular" };
                        newVariantText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
                        newTitleFrame.appendChild(newVariantText);
                    }
                    newSection.appendChild(newTitleFrame);
                    // Try to create instance of NEW component
                    try {
                        const formattedKey = formatComponentKey(mapping.newKey);
                        const newComponent = yield figma.importComponentByKeyAsync(formattedKey);
                        if (newComponent) {
                            const newInstance = newComponent.createInstance();
                            newSection.appendChild(newInstance);
                        }
                    }
                    catch (err) {
                        const errorText = figma.createText();
                        errorText.characters = "⚠️ Component not found";
                        errorText.fontSize = 12;
                        errorText.fontName = { family: "Inter", style: "Regular" };
                        errorText.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }];
                        newSection.appendChild(errorText);
                    }
                    pairFrame.appendChild(newSection);
                    // Add to main frame
                    frame.appendChild(pairFrame);
                }
                catch (err) {
                    console.error('Error creating visual for mapping:', err);
                    hasErrors = true;
                }
            }
            // Select the frame and zoom to it
            figma.currentPage.selection = [frame];
            figma.viewport.scrollAndZoomIntoView([frame]);
            figma.ui.postMessage({
                type: 'message',
                text: hasErrors ?
                    'Visual comparison created with some errors. Some components may not be available.' :
                    'Visual comparison created successfully!',
                variant: hasErrors ? 'warning' : 'info',
                timeout: 3000
            });
        }
        catch (err) {
            console.error('Error generating visuals:', err);
            figma.ui.postMessage({
                type: 'message',
                text: 'Failed to generate visual comparison',
                variant: 'error',
                timeout: 3000
            });
        }
    });
}
// Save mappings to client storage
function saveMappings(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield figma.clientStorage.setAsync('componentMigrationMappings', data);
        }
        catch (err) {
            console.error('Error saving mappings:', err);
        }
    });
}
// Load saved mappings from client storage
function loadSavedMappings() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const saved = yield figma.clientStorage.getAsync('componentMigrationMappings');
            console.log('Loaded from storage:', saved);
            // Handle different data structures for backwards compatibility
            let dataToSend = saved;
            // If saved is an array, it's the old format - wrap it
            if (Array.isArray(saved)) {
                dataToSend = {
                    mappings: saved,
                    timestamp: Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
                };
            }
            figma.ui.postMessage({
                type: 'loadedMappings',
                data: dataToSend
            });
        }
        catch (err) {
            console.error('Error loading mappings:', err);
            figma.ui.postMessage({
                type: 'loadedMappings',
                data: null
            });
        }
    });
}
// Close plugin
figma.on("close", () => {
    figma.closePlugin();
});
