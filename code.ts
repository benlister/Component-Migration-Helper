/// <reference types="@figma/plugin-typings" />

// This plugin helps designers create component migration mappings for design system updates

// Show the UI
figma.showUI(__html__, { 
  width: 380, 
  height: 600,
  title: "Component Migration Helper"
});

// Types
interface Mapping {
  oldKey: string;
  newKey: string;
  oldName: string;
  newName: string;
  notes: string;
}

interface ComponentInfo {
  key: string;
  name: string;
  id: string;
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
figma.ui.onmessage = async msg => {
  switch (msg.type) {
    case 'copySelectedKey':
      await copySelectedComponentKey();
      break;
      
    case 'generateVisuals':
      await generateVisualComparison(msg.mappings);
      break;
      
    case 'saveMappings':
      await saveMappings(msg.data);
      break;
      
    case 'loadMappings':
      await loadSavedMappings();
      break;
      
    case 'getInitialSelection':
      handleSelectionChange();
      break;
  }
};

// Ensure component key is properly formatted for import
function formatComponentKey(key: string): string {
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
  const componentInfo: ComponentInfo[] = [];
  
  for (const node of selection) {
    const componentKey = getComponentKey(node);
    if (componentKey) {
      componentInfo.push({
        key: componentKey,
        name: getComponentName(node),
        id: node.id
      });
    }
  }
  
  figma.ui.postMessage({
    type: 'selectionChange',
    selection: componentInfo
  });
}

// Get component key from a node
function getComponentKey(node: SceneNode): string | null {
  if (node.type === 'COMPONENT') {
    // Get the full component key including file key
    return node.key;
  } else if (node.type === 'INSTANCE') {
    // Use the new async method to avoid deprecation warning
    const mainComponentId = node.mainComponent?.id;
    if (mainComponentId) {
      // For now, return the component key if available
      return node.mainComponent?.key || null;
    }
  }
  return null;
}

// Get a readable component name
function getComponentName(node: SceneNode): string {
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
      if (node.type === 'INSTANCE' && node.mainComponent?.parent?.type === 'COMPONENT_SET') {
        name = node.mainComponent.parent.name;
      } else if (node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET') {
        name = node.parent.name;
      }
    }
    
    // Store variant properties separately for tooltip
    let variantProps = '';
    if ('variantProperties' in node && node.variantProperties) {
      const props = Object.keys(node.variantProperties)
        .map((key) => `${key}=${node.variantProperties![key]}`)
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
async function copySelectedComponentKey() {
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
}

// Generate visual comparison frames
async function generateVisualComparison(mappings: Mapping[]) {
  try {
    // Load the Inter font FIRST, before creating any text nodes
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    
    // Create a new frame for the comparison
    const frame = figma.createFrame();
    frame.name = "Component Migration Visual";
    frame.layoutMode = "HORIZONTAL";
    frame.layoutAlign = "STRETCH";
    frame.itemSpacing = 32;
    frame.paddingLeft = 32;
    frame.paddingRight = 32;
    frame.paddingTop = 32;
    frame.paddingBottom = 32;
    frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = "AUTO";
    
    // Position the frame in view
    frame.x = figma.viewport.center.x - 400;
    frame.y = figma.viewport.center.y - 300;
    
    let hasErrors = false;
    
    for (const mapping of mappings) {
      try {
        // Create container for this mapping
        const pairFrame = figma.createFrame();
        pairFrame.name = `${mapping.oldName || 'Old'} → ${mapping.newName || 'New'}`;
        pairFrame.layoutMode = "VERTICAL";
        pairFrame.layoutAlign = "STRETCH";
        pairFrame.itemSpacing = 16;
        pairFrame.paddingLeft = 16;
        pairFrame.paddingRight = 16;
        pairFrame.paddingTop = 16;
        pairFrame.paddingBottom = 16;
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
        oldSection.itemSpacing = 8;
        
        // OLD label
        const oldLabel = figma.createText();
        oldLabel.characters = "OLD";
        oldLabel.fontSize = 12;
        oldLabel.fontName = { family: "Inter", style: "Bold" };
        oldLabel.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
        oldSection.appendChild(oldLabel);
        
        // OLD component name
        const oldName = figma.createText();
        oldName.characters = mapping.oldName || mapping.oldKey;
        oldName.fontSize = 14;
        oldName.fontName = { family: "Inter", style: "Medium" };
        oldName.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        oldSection.appendChild(oldName);
        
        // Try to create instance of OLD component
        try {
          const formattedKey = formatComponentKey(mapping.oldKey);
          console.log('Trying to import OLD component with key:', formattedKey);
          const oldComponent = await figma.importComponentByKeyAsync(formattedKey);
          if (oldComponent) {
            const oldInstance = oldComponent.createInstance();
            oldSection.appendChild(oldInstance);
          }
        } catch (err) {
          console.error('Failed to import OLD component:', mapping.oldKey, err);
          const errorText = figma.createText();
          errorText.characters = "⚠️ Component not found";
          errorText.fontSize = 12;
          errorText.fontName = { family: "Inter", style: "Regular" };
          errorText.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }];
          oldSection.appendChild(errorText);
          
          // Add debug info
          const debugText = figma.createText();
          debugText.characters = `Key: ${mapping.oldKey.substring(0, 20)}...`;
          debugText.fontSize = 10;
          debugText.fontName = { family: "Inter", style: "Regular" };
          debugText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
          oldSection.appendChild(debugText);
        }
        
        pairFrame.appendChild(oldSection);
        
        // Arrow
        const arrowText = figma.createText();
        arrowText.characters = "↓";
        arrowText.fontSize = 24;
        arrowText.fontName = { family: "Inter", style: "Regular" };
        arrowText.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
        arrowText.textAlignHorizontal = "CENTER";
        pairFrame.appendChild(arrowText);
        
        // NEW component section
        const newSection = figma.createFrame();
        newSection.name = "NEW";
        newSection.layoutMode = "VERTICAL";
        newSection.layoutAlign = "STRETCH";
        newSection.itemSpacing = 8;
        
        // NEW label
        const newLabel = figma.createText();
        newLabel.characters = "NEW";
        newLabel.fontSize = 12;
        newLabel.fontName = { family: "Inter", style: "Bold" };
        newLabel.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 0.2 } }];
        newSection.appendChild(newLabel);
        
        // NEW component name
        const newName = figma.createText();
        newName.characters = mapping.newName || mapping.newKey;
        newName.fontSize = 14;
        newName.fontName = { family: "Inter", style: "Medium" };
        newName.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        newSection.appendChild(newName);
        
        // Try to create instance of NEW component
        try {
          const formattedKey = formatComponentKey(mapping.newKey);
          console.log('Trying to import NEW component with key:', formattedKey);
          const newComponent = await figma.importComponentByKeyAsync(formattedKey);
          if (newComponent) {
            const newInstance = newComponent.createInstance();
            newSection.appendChild(newInstance);
          }
        } catch (err) {
          console.error('Failed to import NEW component:', mapping.newKey, err);
          const errorText = figma.createText();
          errorText.characters = "⚠️ Component not found";
          errorText.fontSize = 12;
          errorText.fontName = { family: "Inter", style: "Regular" };
          errorText.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }];
          newSection.appendChild(errorText);
          
          // Add debug info
          const debugText = figma.createText();
          debugText.characters = `Key: ${mapping.newKey.substring(0, 20)}...`;
          debugText.fontSize = 10;
          debugText.fontName = { family: "Inter", style: "Regular" };
          debugText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
          newSection.appendChild(debugText);
        }
        
        pairFrame.appendChild(newSection);
        
        // Add to main frame
        frame.appendChild(pairFrame);
        
      } catch (err) {
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
    
  } catch (err) {
    console.error('Error generating visuals:', err);
    figma.ui.postMessage({
      type: 'message',
      text: 'Failed to generate visual comparison',
      variant: 'error',
      timeout: 3000
    });
  }
}

// Save mappings to client storage
async function saveMappings(data: unknown) {
  try {
    await figma.clientStorage.setAsync('componentMigrationMappings', data);
  } catch (err) {
    console.error('Error saving mappings:', err);
  }
}

// Load saved mappings from client storage
async function loadSavedMappings() {
  try {
    const saved = await figma.clientStorage.getAsync('componentMigrationMappings');
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
  } catch (err) {
    console.error('Error loading mappings:', err);
    figma.ui.postMessage({
      type: 'loadedMappings',
      data: null
    });
  }
}

// Close plugin
figma.on("close", () => {
  figma.closePlugin();
});